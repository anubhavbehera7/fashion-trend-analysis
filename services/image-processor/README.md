# Image Processor Service (C++/OpenCV)

High-performance feature extraction service using OpenCV 4.x. Extracts 512-dimensional visual feature vectors from fashion images.

## Feature Extraction

| Algorithm | Dimensions | Purpose |
|-----------|-----------|---------|
| HSV Color Histogram | 300D | Color distribution (hue × saturation × value bins) |
| SIFT Descriptors | 128D | Scale-invariant texture and keypoint features |
| ORB Descriptors | 84D | Fast binary features for image fingerprinting |
| **Total** | **512D** | Combined, L2-normalized embedding |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /process | Extract features from image URL |
| POST | /search | Find visually similar images |
| GET | /health | Health + processing stats |

## Building

```bash
# Install dependencies (Ubuntu/Debian)
apt-get install build-essential cmake libopencv-dev libssl-dev nlohmann-json3-dev

# Build
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel

# Run
PORT=8080 QDRANT_URL=http://localhost:6333 ./build/image_processor
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | HTTP port |
| QDRANT_URL | http://localhost:6333 | Qdrant server URL |
| QDRANT_COLLECTION | fashion_images | Collection name |

## Performance

- ~200 images/second on 4-core CPU (512x512 images)
- SIFT: ~5ms per image
- ORB: ~0.5ms per image
- HSV histogram: ~0.2ms per image
- Qdrant upsert: ~1ms per vector

## Why C++?

- Direct memory control: `cv::Mat` operates in-place, no Python GIL
- SIMD-optimized OpenCV operations (SSE4/AVX2)
- No garbage collection pauses
- ~10x faster than equivalent Python/OpenCV code for this workload
