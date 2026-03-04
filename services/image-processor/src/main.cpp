/**
 * Image Processor Service — HTTP Server
 *
 * C++/OpenCV microservice that extracts 512-dimensional feature vectors from fashion images.
 * Uses cpp-httplib for HTTP server, OpenCV for computer vision, and nlohmann/json for JSON.
 *
 * Performance: ~200 images/second on 4-core CPU (512x512 images)
 * Why C++ here? Direct memory control, no GIL, SIMD-optimized OpenCV operations.
 *
 * Endpoints:
 *   POST /process  — Download and extract features from an image URL
 *   POST /search   — Find visually similar images using vector search
 *   GET  /health   — Health check for Kubernetes probes
 */

#include <httplib.h>
#include <nlohmann/json.hpp>
#include <opencv2/opencv.hpp>
#include <opencv2/imgcodecs.hpp>

#include "feature_extractor.h"
#include "qdrant_client.h"

#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <cstdlib>
#include <memory>
#include <atomic>

using json = nlohmann::json;
using namespace fashion;

// ─── Global state (initialized once at startup) ────────────────────────────────
std::unique_ptr<FeatureExtractor> g_extractor;
std::unique_ptr<QdrantClient>    g_qdrant;
std::atomic<int64_t>             g_processed_count{0};
std::atomic<int64_t>             g_total_processing_ms{0};

// ─── Helper: download image from URL using libcurl-style httplib ────────────────
cv::Mat downloadImage(const std::string& url) {
    // Parse URL: extract host and path
    std::string host, path;
    bool is_https = false;

    if (url.substr(0, 8) == "https://") {
        is_https = true;
        host = url.substr(8);
    } else if (url.substr(0, 7) == "http://") {
        host = url.substr(7);
    } else {
        throw std::invalid_argument("Invalid URL: must start with http:// or https://");
    }

    auto slash_pos = host.find('/');
    if (slash_pos != std::string::npos) {
        path = host.substr(slash_pos);
        host = host.substr(0, slash_pos);
    } else {
        path = "/";
    }

    // Use httplib for HTTP download (cpp-httplib supports HTTPS with OpenSSL)
    std::string body;
    int status = 0;

    if (is_https) {
        httplib::SSLClient cli(host);
        cli.set_connection_timeout(10);
        cli.set_read_timeout(30);
        auto res = cli.Get(path);
        if (!res || res->status != 200) {
            throw std::runtime_error("Failed to download image: HTTP " +
                (res ? std::to_string(res->status) : "connection failed"));
        }
        body = res->body;
    } else {
        httplib::Client cli(host);
        cli.set_connection_timeout(10);
        cli.set_read_timeout(30);
        auto res = cli.Get(path);
        if (!res || res->status != 200) {
            throw std::runtime_error("Failed to download image: HTTP " +
                (res ? std::to_string(res->status) : "connection failed"));
        }
        body = res->body;
    }

    // Decode image from memory buffer (avoids writing to disk — faster and cleaner)
    std::vector<unsigned char> buffer(body.begin(), body.end());
    cv::Mat img = cv::imdecode(buffer, cv::IMREAD_COLOR);

    if (img.empty()) {
        throw std::runtime_error("Failed to decode image — unsupported format or corrupt data");
    }

    return img;
}

// ─── Request Handlers ─────────────────────────────────────────────────────────

/**
 * POST /process
 * Body: { "imageUrl": "https://...", "metadata": {...} }
 * Response: { "vectorId": "uuid", "features": [...512 floats...], "processingTimeMs": 42 }
 */
void handleProcess(const httplib::Request& req, httplib::Response& res) {
    auto start = std::chrono::high_resolution_clock::now();

    try {
        auto body = json::parse(req.body);

        if (!body.contains("imageUrl") || !body["imageUrl"].is_string()) {
            res.status = 400;
            res.set_content(json{{"error", "imageUrl is required"}}.dump(), "application/json");
            return;
        }

        std::string imageUrl = body["imageUrl"].get<std::string>();
        json metadata = body.value("metadata", json::object());

        // Download image from URL
        cv::Mat image = downloadImage(imageUrl);

        // Extract 512D feature vector (the core CV operation)
        std::vector<float> features = g_extractor->extractFeatures(image);

        // Generate a unique ID for this vector
        // In production, use a proper UUID library. Here we use a simple hash.
        std::string vectorId = std::to_string(
            std::hash<std::string>{}(imageUrl + std::to_string(
                std::chrono::system_clock::now().time_since_epoch().count()
            ))
        );

        // Add source URL to payload so we can retrieve it during search
        metadata["imageUrl"] = imageUrl;
        metadata["processedAt"] = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();

        // Store in Qdrant vector database
        g_qdrant->upsertVector(vectorId, features, metadata);

        auto end = std::chrono::high_resolution_clock::now();
        auto duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

        // Update statistics
        g_processed_count++;
        g_total_processing_ms += duration_ms;

        json response = {
            {"vectorId", vectorId},
            {"features", features},
            {"processingTimeMs", duration_ms},
            {"featureDimension", features.size()}
        };

        res.set_content(response.dump(), "application/json");

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] /process: " << e.what() << std::endl;
        res.status = 500;
        res.set_content(json{{"error", e.what()}}.dump(), "application/json");
    }
}

/**
 * POST /search
 * Body: { "vectorId": "...", "limit": 10 }
 * Response: { "results": [...], "searchTimeMs": 5 }
 */
void handleSearch(const httplib::Request& req, httplib::Response& res) {
    auto start = std::chrono::high_resolution_clock::now();

    try {
        auto body = json::parse(req.body);

        if (!body.contains("vectorId")) {
            res.status = 400;
            res.set_content(json{{"error", "vectorId is required"}}.dump(), "application/json");
            return;
        }

        std::string vectorId = body["vectorId"].get<std::string>();
        int limit = body.value("limit", 10);
        float threshold = body.value("scoreThreshold", 0.5f);

        // Retrieve the stored vector from Qdrant
        std::vector<float> queryVector = g_qdrant->getVector(vectorId);

        // Perform approximate nearest-neighbor search (HNSW, O(log N))
        auto results = g_qdrant->searchSimilar(queryVector, limit, threshold);

        auto end = std::chrono::high_resolution_clock::now();
        auto duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

        // Format results
        json resultsJson = json::array();
        for (const auto& r : results) {
            resultsJson.push_back({
                {"id", r.id},
                {"score", r.score},
                {"url", r.payload.value("imageUrl", "")},
                {"metadata", r.payload}
            });
        }

        json response = {
            {"results", resultsJson},
            {"searchTimeMs", duration_ms}
        };

        res.set_content(response.dump(), "application/json");

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] /search: " << e.what() << std::endl;
        res.status = 500;
        res.set_content(json{{"error", e.what()}}.dump(), "application/json");
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

int main() {
    // Read configuration from environment variables
    int    port           = std::atoi(std::getenv("PORT")   ? std::getenv("PORT")   : "8080");
    std::string qdrant_url = std::getenv("QDRANT_URL")      ? std::getenv("QDRANT_URL")      : "http://localhost:6333";
    std::string collection = std::getenv("QDRANT_COLLECTION")? std::getenv("QDRANT_COLLECTION"): "fashion_images";

    // Parse Qdrant host:port from URL
    std::string qdrant_host = "localhost";
    int qdrant_port = 6333;
    auto colon_pos = qdrant_url.rfind(':');
    if (colon_pos != std::string::npos && colon_pos > 7) {
        qdrant_host = qdrant_url.substr(7, colon_pos - 7);
        qdrant_port = std::stoi(qdrant_url.substr(colon_pos + 1));
    }

    std::cout << "[INFO] Initializing feature extractor..." << std::endl;
    g_extractor = std::make_unique<FeatureExtractor>();
    std::cout << "[INFO] Feature extractor ready (512D SIFT+ORB+HSV)" << std::endl;

    std::cout << "[INFO] Connecting to Qdrant at " << qdrant_host << ":" << qdrant_port << std::endl;
    g_qdrant = std::make_unique<QdrantClient>(qdrant_host, qdrant_port, collection);
    std::cout << "[INFO] Qdrant connected, collection: " << collection << std::endl;

    // ─── HTTP Server ────────────────────────────────────────────────────────
    httplib::Server svr;

    svr.Post("/process", handleProcess);
    svr.Post("/search",  handleSearch);

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        int64_t count = g_processed_count.load();
        int64_t total_ms = g_total_processing_ms.load();
        float avg_ms = count > 0 ? static_cast<float>(total_ms) / count : 0.0f;

        json response = {
            {"status", "ok"},
            {"service", "image-processor"},
            {"stats", {
                {"imagesProcessed", count},
                {"avgProcessingMs", avg_ms},
                {"imgsPerSecondCapacity", avg_ms > 0 ? 1000.0f / avg_ms : 0.0f}
            }}
        };
        res.set_content(response.dump(), "application/json");
    });

    svr.set_error_handler([](const httplib::Request&, httplib::Response& res) {
        json error = {{"error", "Internal server error"}};
        res.set_content(error.dump(), "application/json");
    });

    std::cout << "[INFO] Image Processor listening on port " << port << std::endl;
    std::cout << "[INFO] Endpoints: POST /process, POST /search, GET /health" << std::endl;

    svr.listen("0.0.0.0", port);
    return 0;
}
