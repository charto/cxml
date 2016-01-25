#pragma once

#include <nbind/api.h>

#include "Patricia.h"

class Namespace {

public:

	Namespace(nbind::Buffer buffer);

	Patricia elementTrie;
	Patricia attributeTrie;

private:

	/** Handle to the JavaScript buffer with inserted data,
	  * to prevent garbage collecting it too early. */
	nbind::Buffer buffer;

};
