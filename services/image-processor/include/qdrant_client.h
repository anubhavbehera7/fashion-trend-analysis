#pragma once
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

namespace fashion {

struct QdrantSearchResult {
    std::string id;
    float score;
    nlohmann::json payload;
};

class QdrantClient {
public:
    QdrantClient(const std::string& host, int port, const std::string& collection);

    std::string upsertVector(
        const std::string& id,
        const std::vector<float>& vector,
        const nlohmann::json& payload
    );

    std::vector<QdrantSearchResult> searchSimilar(
        const std::vector<float>& queryVector,
        int topK = 10,
        float scoreThreshold = 0.5f
    );

    std::vector<float> getVector(const std::string& id);

private:
    std::string host_;
    int port_;
    std::string collection_;

    void ensureCollectionExists();
};

}  // namespace fashion
