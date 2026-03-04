#pragma once
#include <string>
#include <vector>

namespace fashion {
std::string base64Encode(const std::vector<unsigned char>& data);
std::vector<unsigned char> base64Decode(const std::string& encoded);
}
