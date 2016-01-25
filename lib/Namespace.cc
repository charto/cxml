#include "Namespace.h"

Namespace :: Namespace(nbind::Buffer buffer) : buffer(buffer) {
	unsigned char *buf = buffer.data();

	unsigned int elementOffset = 3;
	unsigned int attributeOffset = (buf[0] << 16) + (buf[1] << 8) + buf[2];

	elementTrie.setRoot(buf + elementOffset);
	attributeTrie.setRoot(buf + attributeOffset);
}

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(Namespace) {
	construct<nbind::Buffer>();
}

#endif
