#pragma once
/**
 * FeatureExtractor — Computer vision feature extraction for fashion images.
 *
 * Extracts a 512-dimensional feature vector from each image by combining:
 *   - 300D HSV color histogram: captures color distribution across hue/saturation/value
 *   - 128D SIFT descriptor:     scale-invariant keypoint features (texture, structure)
 *   -  84D ORB descriptor:      fast binary features for image fingerprinting
 *
 * The combined vector is stored in Qdrant for approximate nearest-neighbor search.
 *
 * Why these three algorithms?
 *   - Color alone fails to distinguish structure (a red polka-dot dress ≠ red solid dress)
 *   - SIFT alone is slow but highly accurate — good for texture/pattern matching
 *   - ORB is ~100x faster than SIFT but less discriminative — used as a complement
 *   - Together they cover: color palette, fabric texture, and garment structure
 */

#include <opencv2/opencv.hpp>
#include <opencv2/features2d.hpp>

// SIFT is in the main features2d module since OpenCV 4.4 (no opencv_contrib needed)
#include <vector>
#include <string>

namespace fashion {

// Total feature vector dimension: 300 (color) + 128 (SIFT) + 84 (ORB) = 512
constexpr int COLOR_HISTOGRAM_DIM = 300;  // 10 hue bins × 10 sat bins × 3 val bins
constexpr int SIFT_DESCRIPTOR_DIM = 128;  // Standard SIFT descriptor size
constexpr int ORB_DESCRIPTOR_DIM  = 84;   // 256-bit ORB → 32 bytes → 84 floats after L2-norm
constexpr int TOTAL_FEATURE_DIM   = COLOR_HISTOGRAM_DIM + SIFT_DESCRIPTOR_DIM + ORB_DESCRIPTOR_DIM;

/**
 * Extracts multi-modal feature vectors from fashion images.
 * Thread-safe: SIFT/ORB detectors are created per-instance (not shared).
 */
class FeatureExtractor {
public:
    FeatureExtractor();
    ~FeatureExtractor() = default;

    // Non-copyable (OpenCV detector objects are not safely copyable)
    FeatureExtractor(const FeatureExtractor&) = delete;
    FeatureExtractor& operator=(const FeatureExtractor&) = delete;

    /**
     * Extract full 512D feature vector from an image.
     * Combines color histogram + SIFT + ORB features.
     *
     * @param image  Input image in BGR format (OpenCV default)
     * @return       Normalized 512D float vector
     */
    std::vector<float> extractFeatures(const cv::Mat& image);

    /**
     * Extract HSV color histogram (300D).
     *
     * HSV color space is better than RGB for fashion because:
     * - Hue captures the actual color independent of lighting
     * - Saturation captures color richness (pastel vs vivid)
     * - Value captures brightness (useful for dark/light fashion)
     *
     * We use 10×10×3 bins = 300 dimensions. More bins = more precise
     * but also more sparse (fewer matching vectors in the database).
     */
    std::vector<float> extractColorHistogram(const cv::Mat& image);

    /**
     * Extract SIFT keypoint descriptors (128D aggregate).
     *
     * SIFT (Scale-Invariant Feature Transform) detects keypoints that are
     * stable under rotation, scaling, and illumination changes. Each keypoint
     * produces a 128D descriptor. We aggregate all descriptors into a single
     * 128D vector using the bag-of-visual-words approach (mean pooling here).
     *
     * Why SIFT? It excels at:
     * - Fabric texture recognition (tweed vs denim vs silk)
     * - Pattern matching (stripes, plaid, floral)
     * - Finding similar silhouettes despite different colors
     */
    std::vector<float> extractSIFTFeatures(const cv::Mat& image);

    /**
     * Extract ORB binary descriptors (84D aggregate).
     *
     * ORB (Oriented FAST and Rotated BRIEF) is a binary descriptor:
     * - ~100x faster than SIFT to compute
     * - Much smaller memory footprint (binary vs float)
     * - Slightly less discriminative but great for fast matching
     *
     * We extract 500 keypoints, aggregate descriptors via mean pooling,
     * then L2-normalize to make them compatible with cosine similarity.
     */
    std::vector<float> extractORBFeatures(const cv::Mat& image);

private:
    cv::Ptr<cv::SIFT>  sift_detector_;
    cv::Ptr<cv::ORB>   orb_detector_;

    /**
     * Preprocess image for feature extraction:
     * - Resize to standard size (512×512) for consistent descriptor computation
     * - Convert to grayscale for SIFT/ORB (they work on intensity, not color)
     */
    cv::Mat preprocessImage(const cv::Mat& image);

    /**
     * L2-normalize a vector so it lies on the unit hypersphere.
     * Required for cosine similarity to work correctly in Qdrant.
     * If the vector is all zeros (no keypoints found), returns zeros.
     */
    void l2Normalize(std::vector<float>& vec);
};

}  // namespace fashion
