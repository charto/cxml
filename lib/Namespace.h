#pragma once

#include <string>

#include <nbind/api.h>

#include "Patricia.h"

class Namespace {

public:

	explicit Namespace(std::string uri) : uri(uri) {}

	void setElementTrie(nbind::Buffer buffer) {
		elementTrie.setBuffer(buffer);
	}

	void setAttributeTrie(nbind::Buffer buffer) {
		attributeTrie.setBuffer(buffer);
	}

	// TODO:
	// void setValueTrie(nbind::Buffer buffer) {
		// valueTrie.setBuffer(buffer);
	// }

	std::string uri;

	Patricia elementTrie;
	Patricia attributeTrie;
	// TODO:
	// Patricia valueTrie;

};
