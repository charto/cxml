#include "ParserConfig.h"

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(ParserConfig) {
	construct<>();

	method(addNamespace);
}

#endif
