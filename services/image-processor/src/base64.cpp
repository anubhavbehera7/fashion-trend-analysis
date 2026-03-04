/**
 * Base64 encoder/decoder for image data transmission.
 * Used to send binary image data over JSON (which only supports text).
 */
#include "base64.h"
#include <stdexcept>

namespace fashion {

static const std::string BASE64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string base64Encode(const std::vector<unsigned char>& data) {
    std::string result;
    result.reserve(((data.size() + 2) / 3) * 4);

    for (size_t i = 0; i < data.size(); i += 3) {
        unsigned char b0 = data[i];
        unsigned char b1 = (i + 1 < data.size()) ? data[i + 1] : 0;
        unsigned char b2 = (i + 2 < data.size()) ? data[i + 2] : 0;

        result += BASE64_CHARS[(b0 >> 2) & 0x3F];
        result += BASE64_CHARS[((b0 & 0x03) << 4) | ((b1 & 0xF0) >> 4)];
        result += (i + 1 < data.size()) ? BASE64_CHARS[((b1 & 0x0F) << 2) | ((b2 & 0xC0) >> 6)] : '=';
        result += (i + 2 < data.size()) ? BASE64_CHARS[b2 & 0x3F] : '=';
    }
    return result;
}

std::vector<unsigned char> base64Decode(const std::string& encoded) {
    std::vector<unsigned char> result;
    result.reserve((encoded.size() / 4) * 3);

    auto isBase64 = [](unsigned char c) {
        return (isalnum(c) || c == '+' || c == '/');
    };

    for (size_t i = 0; i < encoded.size(); i += 4) {
        unsigned char c0 = isBase64(encoded[i])     ? BASE64_CHARS.find(encoded[i])     : 0;
        unsigned char c1 = isBase64(encoded[i + 1]) ? BASE64_CHARS.find(encoded[i + 1]) : 0;
        unsigned char c2 = (i + 2 < encoded.size() && isBase64(encoded[i + 2]))
                           ? BASE64_CHARS.find(encoded[i + 2]) : 0;
        unsigned char c3 = (i + 3 < encoded.size() && isBase64(encoded[i + 3]))
                           ? BASE64_CHARS.find(encoded[i + 3]) : 0;

        result.push_back((c0 << 2) | (c1 >> 4));
        if (i + 2 < encoded.size() && encoded[i + 2] != '=') {
            result.push_back(((c1 & 0x0F) << 4) | (c2 >> 2));
        }
        if (i + 3 < encoded.size() && encoded[i + 3] != '=') {
            result.push_back(((c2 & 0x03) << 6) | c3);
        }
    }
    return result;
}

}  // namespace fashion
