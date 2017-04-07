#pragma once

#include <nbind/api.h>

#include "Patricia.h"

class Namespace {

public:

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

	Patricia elementTrie;
	Patricia attributeTrie;
	// TODO:
	// Patricia valueTrie;

};
