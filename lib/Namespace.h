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

	Patricia elementTrie;
	Patricia attributeTrie;

};
