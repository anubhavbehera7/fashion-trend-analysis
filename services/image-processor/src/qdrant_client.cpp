/**
 * QdrantClient — HTTP client for Qdrant vector database operations.
 *
 * Qdrant is a Rust-based vector database optimized for:
 * - HNSW (Hierarchical Navigable Small World) approximate nearest-neighbor search
 * - Payload filtering (search by metadata while doing vector similarity)
 * - High throughput with low memory usage
 *
 * We store 512D fashion image embeddings and search for visually similar images
 * using cosine similarity.
 */

#include "qdrant_client.h"
#include <nlohmann/json.hpp>
#include <httplib.h>
#include <sstream>
#include <stdexcept>
#include <iostream>

namespace fashion {

using json = nlohmann::json;

QdrantClient::QdrantClient(const std::string& host, int port, const std::string& collection)
    : host_(host), port_(port), collection_(collection) {

    // Ensure the collection exists when client is created
    ensureCollectionExists();
}

void QdrantClient::ensureCollectionExists() {
    httplib::Client client(host_, port_);
    client.set_connection_timeout(5);

    // Check if collection exists
    auto res = client.Get("/collections/" + collection_);
    if (res && res->status == 200) {
        return;  // Already exists
    }

    // Create collection with cosine similarity metric
    // HNSW index parameters:
    //   m: 16 connections per node (higher = better recall, more memory)
    //   ef_construct: 100 candidates during construction (higher = better quality, slower build)
    json body = {
        {"vectors", {
            {"size", 512},        // Our 512D embedding dimension
            {"distance", "Cosine"}  // Cosine similarity for normalized vectors
        }},
        {"hnsw_config", {
            {"m", 16},
            {"ef_construct", 100}
        }}
    };

    auto put_res = client.Put(
        "/collections/" + collection_,
        body.dump(),
        "application/json"
    );

    if (!put_res || put_res->status != 200) {
        std::cerr << "Warning: Could not create Qdrant collection: "
                  << (put_res ? put_res->body : "connection failed") << std::endl;
    } else {
        std::cout << "Created Qdrant collection: " << collection_ << std::endl;
    }
}

std::string QdrantClient::upsertVector(
    const std::string& id,
    const std::vector<float>& vector,
    const json& payload
) {
    httplib::Client client(host_, port_);
    client.set_connection_timeout(10);
    client.set_read_timeout(10);

    // Qdrant upsert: insert or update if ID already exists
    json body = {
        {"points", json::array({
            {
                {"id", id},
                {"vector", vector},
                {"payload", payload}
            }
        })}
    };

    auto res = client.Put(
        "/collections/" + collection_ + "/points",
        body.dump(),
        "application/json"
    );

    if (!res || res->status != 200) {
        throw std::runtime_error("Qdrant upsert failed: " +
            (res ? res->body : "connection failed"));
    }

    return id;
}

std::vector<QdrantSearchResult> QdrantClient::searchSimilar(
    const std::vector<float>& queryVector,
    int topK,
    float scoreThreshold
) {
    httplib::Client client(host_, port_);
    client.set_connection_timeout(10);
    client.set_read_timeout(10);

    json body = {
        {"vector", queryVector},
        {"limit", topK},
        {"score_threshold", scoreThreshold},
        {"with_payload", true},    // Include metadata in results
        {"with_vector", false}     // Don't return vectors (saves bandwidth)
    };

    auto res = client.Post(
        "/collections/" + collection_ + "/points/search",
        body.dump(),
        "application/json"
    );

    if (!res || res->status != 200) {
        throw std::runtime_error("Qdrant search failed: " +
            (res ? res->body : "connection failed"));
    }

    auto response = json::parse(res->body);
    std::vector<QdrantSearchResult> results;

    for (const auto& hit : response["result"]) {
        QdrantSearchResult result;
        result.id = hit["id"].get<std::string>();
        result.score = hit["score"].get<float>();
        result.payload = hit["payload"];
        results.push_back(result);
    }

    return results;
}

std::vector<float> QdrantClient::getVector(const std::string& id) {
    httplib::Client client(host_, port_);

    auto res = client.Get("/collections/" + collection_ + "/points/" + id);
    if (!res || res->status != 200) {
        throw std::runtime_error("Qdrant get vector failed: " +
            (res ? res->body : "connection failed"));
    }

    auto response = json::parse(res->body);
    return response["result"]["vector"].get<std::vector<float>>();
}

}  // namespace fashion
