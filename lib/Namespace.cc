#include "Namespace.h"

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(Namespace) {
	construct<std::string>();
	method(clone);
	method(setElementTrie);
	method(setAttributeTrie);
	// TODO:
	// method(setValueTrie);
}

#endif
