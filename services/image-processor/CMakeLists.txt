cmake_minimum_required(VERSION 3.16)
project(ImageProcessor VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build type defaults to Release for production performance
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Optimization flags for Release builds
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -march=native")

# ─── Dependencies ─────────────────────────────────────────────────────────────

# OpenCV 4.x — computer vision library
# Requires: libopencv-dev on Ubuntu, opencv on macOS via brew
find_package(OpenCV 4 REQUIRED COMPONENTS
  core
  imgproc
  imgcodecs
  features2d
)

# nlohmann/json — header-only JSON library
# Can also be installed via: apt-get install nlohmann-json3-dev
find_package(nlohmann_json 3.2.0 QUIET)
if(NOT nlohmann_json_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
  )
  FetchContent_MakeAvailable(json)
endif()

# cpp-httplib — header-only HTTP server/client library
find_package(httplib QUIET)
if(NOT httplib_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.14.1
  )
  FetchContent_MakeAvailable(httplib)
endif()

# ─── Target ───────────────────────────────────────────────────────────────────

add_executable(image_processor
  src/main.cpp
  src/feature_extractor.cpp
  src/qdrant_client.cpp
  src/base64.cpp
)

target_include_directories(image_processor PRIVATE
  ${CMAKE_SOURCE_DIR}/include
  ${OpenCV_INCLUDE_DIRS}
)

target_link_libraries(image_processor PRIVATE
  ${OpenCV_LIBS}
  nlohmann_json::nlohmann_json
  httplib::httplib
  pthread
)

# Enable all warnings in debug builds
target_compile_options(image_processor PRIVATE
  $<$<CONFIG:Debug>:-Wall -Wextra -Wpedantic>
)

install(TARGETS image_processor DESTINATION bin)
