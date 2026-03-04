# Stage 1: Build C++ application
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libopencv-dev \
    libssl-dev \
    nlohmann-json3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source files
COPY CMakeLists.txt .
COPY src/ ./src/
COPY include/ ./include/

# Build with CMake (Release mode for production performance)
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --parallel $(nproc)

# Stage 2: Runtime image (smaller than builder)
FROM ubuntu:22.04 AS production

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    libopencv-core4.5d \
    libopencv-imgproc4.5d \
    libopencv-imgcodecs4.5d \
    libopencv-features2d4.5d \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Security: non-root user
RUN useradd -r -s /bin/false appuser

WORKDIR /app
COPY --from=builder /app/build/image_processor .

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -sf http://localhost:8080/health || exit 1

CMD ["./image_processor"]
