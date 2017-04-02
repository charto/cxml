#include "Namespace.h"

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(Namespace) {
	construct<>();
	method(setElementTrie);
	method(setAttributeTrie);
}

#endif
