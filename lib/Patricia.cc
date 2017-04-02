#include "Patricia.h"
#include "PatriciaCursor.h"

uint32_t Patricia :: find(const char *needle) {
	PatriciaCursor cursor;
	char c;

	cursor.init(*this);
	while((c = *needle++)) cursor.advance(c);

	return(cursor.getData());
}

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(Patricia) {
	construct<>();
	method(setBuffer);
	method(find);
}

#endif
