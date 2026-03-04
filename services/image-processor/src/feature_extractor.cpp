/**
 * FeatureExtractor — Implementation
 *
 * Computer vision feature extraction using OpenCV. Extracts a 512D feature vector
 * per image by combining HSV color histogram (300D), SIFT (128D), and ORB (84D).
 */

#include "feature_extractor.h"
#include <numeric>
#include <stdexcept>
#include <cmath>

namespace fashion {

FeatureExtractor::FeatureExtractor() {
    // SIFT: 500 keypoints, 3 octave layers. More keypoints = better but slower.
    // 500 is a good balance for fashion images at 512x512.
    sift_detector_ = cv::SIFT::create(
        500,   // nfeatures: max keypoints to detect
        3,     // nOctaveLayers: layers per scale octave
        0.04,  // contrastThreshold: filter weak keypoints
        10,    // edgeThreshold: filter edge keypoints
        1.6    // sigma: Gaussian blur for first octave
    );

    // ORB: 500 keypoints, scale factor 1.2, 8 pyramid levels
    orb_detector_ = cv::ORB::create(
        500,    // nfeatures
        1.2f,   // scaleFactor: scale between pyramid levels
        8,      // nlevels: pyramid levels
        31,     // edgeThreshold: border size for keypoints
        0,      // firstLevel: start level (0 = original size)
        2,      // WTA_K: points compared per test
        cv::ORB::HARRIS_SCORE,  // Harris score is more stable than FAST score
        31,     // patchSize: patch size for BRIEF descriptor
        20      // fastThreshold
    );
}

cv::Mat FeatureExtractor::preprocessImage(const cv::Mat& image) {
    cv::Mat processed;

    // Standardize image size for consistent feature extraction.
    // 512x512 is large enough to preserve texture details while being fast.
    const int TARGET_SIZE = 512;
    if (image.rows != TARGET_SIZE || image.cols != TARGET_SIZE) {
        cv::resize(image, processed, cv::Size(TARGET_SIZE, TARGET_SIZE),
                   0, 0, cv::INTER_LANCZOS4);  // Lanczos4 = best quality for downscaling
    } else {
        processed = image.clone();
    }

    return processed;
}

void FeatureExtractor::l2Normalize(std::vector<float>& vec) {
    float norm = 0.0f;
    for (float v : vec) norm += v * v;
    norm = std::sqrt(norm);

    if (norm > 1e-8f) {  // Avoid division by zero
        for (float& v : vec) v /= norm;
    }
    // If norm ~= 0 (all zeros), leave as zeros — these won't match anything
}

std::vector<float> FeatureExtractor::extractColorHistogram(const cv::Mat& image) {
    // Convert BGR → HSV.
    // HSV separates color (H) from intensity (V), making histograms
    // more robust to lighting changes — important for product photos.
    cv::Mat hsv;
    cv::cvtColor(image, hsv, cv::COLOR_BGR2HSV);

    // Define bin counts for each HSV channel.
    // Hue: 0-180° (OpenCV uses 0-180 for H), 10 bins = 18° per bin
    // Saturation: 0-255, 10 bins = 25.5 per bin
    // Value: 0-255, 3 bins (dark/medium/bright) — coarse because
    //        value changes too much with lighting; we don't want it to dominate
    int h_bins = 10, s_bins = 10, v_bins = 3;
    int histSize[] = {h_bins, s_bins, v_bins};

    // Hue: 0-181 (slightly > 180 to include 180)
    float h_ranges[] = {0, 181};
    float s_ranges[] = {0, 256};
    float v_ranges[] = {0, 256};
    const float* ranges[] = {h_ranges, s_ranges, v_ranges};
    int channels[] = {0, 1, 2};

    cv::Mat hist;
    cv::calcHist(&hsv, 1, channels, cv::Mat(), hist, 3, histSize, ranges);

    // Normalize histogram to [0, 1] — makes it scale-invariant
    cv::normalize(hist, hist, 0, 1, cv::NORM_MINMAX);

    // Flatten 3D histogram to 1D vector (10 × 10 × 3 = 300 values)
    hist = hist.reshape(1, 1);
    std::vector<float> result(hist.ptr<float>(), hist.ptr<float>() + hist.total());

    return result;  // 300D
}

std::vector<float> FeatureExtractor::extractSIFTFeatures(const cv::Mat& image) {
    // SIFT works on grayscale images — convert from BGR
    cv::Mat gray;
    cv::cvtColor(image, gray, cv::COLOR_BGR2GRAY);

    // Detect keypoints and compute 128D descriptors for each
    std::vector<cv::KeyPoint> keypoints;
    cv::Mat descriptors;
    sift_detector_->detectAndCompute(gray, cv::noArray(), keypoints, descriptors);

    std::vector<float> result(SIFT_DESCRIPTOR_DIM, 0.0f);

    if (descriptors.empty()) {
        // No keypoints found (e.g., blank/uniform image) — return zero vector
        return result;
    }

    // Aggregate descriptors using mean pooling (bag-of-visual-words lite).
    // Alternative: use Fisher vectors or VLAD for better discriminability,
    // but mean pooling is fast and works well for fashion imagery.
    for (int i = 0; i < descriptors.rows; ++i) {
        for (int j = 0; j < descriptors.cols; ++j) {
            result[j] += descriptors.at<float>(i, j);
        }
    }

    // Divide by number of keypoints to get the mean
    float n = static_cast<float>(descriptors.rows);
    for (float& v : result) v /= n;

    l2Normalize(result);
    return result;  // 128D
}

std::vector<float> FeatureExtractor::extractORBFeatures(const cv::Mat& image) {
    cv::Mat gray;
    cv::cvtColor(image, gray, cv::COLOR_BGR2GRAY);

    std::vector<cv::KeyPoint> keypoints;
    cv::Mat descriptors;
    orb_detector_->detectAndCompute(gray, cv::noArray(), keypoints, descriptors);

    // ORB produces 32-byte (256-bit) binary descriptors.
    // We convert to float for mean pooling, yielding 32 float values.
    // After padding to 84D (to align with our vector layout), we L2-normalize.
    std::vector<float> result(ORB_DESCRIPTOR_DIM, 0.0f);

    if (descriptors.empty()) {
        return result;
    }

    // Convert binary (uchar) descriptors to float, then mean-pool
    cv::Mat descriptors_float;
    descriptors.convertTo(descriptors_float, CV_32F, 1.0 / 255.0);  // Scale to [0,1]

    for (int i = 0; i < descriptors_float.rows; ++i) {
        for (int j = 0; j < descriptors_float.cols && j < ORB_DESCRIPTOR_DIM; ++j) {
            result[j] += descriptors_float.at<float>(i, j);
        }
    }

    float n = static_cast<float>(descriptors_float.rows);
    for (float& v : result) v /= n;

    l2Normalize(result);
    return result;  // 84D (padded from 32D)
}

std::vector<float> FeatureExtractor::extractFeatures(const cv::Mat& image) {
    if (image.empty()) {
        throw std::invalid_argument("Input image is empty");
    }

    // Preprocess: standardize size
    cv::Mat processed = preprocessImage(image);

    // Extract all three feature types in parallel would be possible with std::async,
    // but the bottleneck is typically I/O (image download), not CPU.
    auto color_hist = extractColorHistogram(processed);   // 300D
    auto sift_feat  = extractSIFTFeatures(processed);     // 128D
    auto orb_feat   = extractORBFeatures(processed);      //  84D

    // Concatenate into final 512D vector
    // Order: color → sift → orb (each normalized separately before concat)
    std::vector<float> combined;
    combined.reserve(TOTAL_FEATURE_DIM);
    combined.insert(combined.end(), color_hist.begin(), color_hist.end());
    combined.insert(combined.end(), sift_feat.begin(), sift_feat.end());
    combined.insert(combined.end(), orb_feat.begin(), orb_feat.end());

    // Final L2-normalization of the full vector for Qdrant cosine similarity
    l2Normalize(combined);

    return combined;  // 512D
}

}  // namespace fashion
