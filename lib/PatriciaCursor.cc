#include <cstdio>

#include "PatriciaCursor.h"

bool PatriciaCursor :: advance(unsigned char c) {
	const unsigned char *p = ptr;
	unsigned char delta;

	// Loop until the current trie branch node contains an entire byte.
	while(len < 8) {
		if(len) {
			// Compare input with branch node contents by using XOR, and
			// shift away trailing bits not contained in the node.
			delta = (c ^ *p++) >> (7 - len);
		} else {
			// If the branch doesn't depend on any bits inside the byte,
			// it must be the last byte of an inserted string.
			// An associated data value will follow so jump over it.
			delta = 0;

			// High bit of associated data value signals no longer strings
			// with this prefix exist.
			if(*p & 0x80) {
				// TODO: should this be p or p - 1 ?
				ptr = p - 1;
				return(false);
			}
		}

		if(delta) {
			// If input differs from branch node contents in bits before
			// the last one, then it was not found in the trie.
			if(delta > 1) {
				ptr = p - 1;
				return(false);
			}

			// If the last bit differs, find pointer to the second child.
			// It must exist, otherwise there would be no branch here.
			p += (p[0] << 16) + (p[1] << 8) + p[2];
		} else {
			// This branch is conditioned on a bit so it has a pointer
			// to a second child, or it ends on a byte boundary so it has
			// a data pointer. In either case, jump over a pointer to find
			// the first child node.
			p += 3;
		}

		// Entered a new node, so read its length.
		len = *p++;
	}

	len -= 8;

	// If the node contains a full byte but the input doesn't match,
	// then it was not found in the trie.
	if(c != *p++) {
		ptr = p;
		return(false);
	}

	if(!len) {
		// If the branch doesn't depend on any bits inside the byte,
		// it must be the last byte of an inserted string.
		// Store the location of its data value.
		// printf("*");
		found = p;

		// NOTE: Nodes longer than 32 bytes must be split, so intermediate
		// nodes represent partial strings not actually inserted. Their
		// associated value is Patricia :: notFound, so results are unaffected.
	}

	ptr = p;
	return(true);
}

bool PatriciaCursor :: transfer(const Patricia &trie) {
	const unsigned char *p = trie.root;
	const unsigned char *target = ptr;
	unsigned char c;
	PatriciaCursor other;

	other.init(trie);

	// TODO!
	while(0 && p < target) {
		// c = ...

		if(!other.advance(c)) return(false);
	}

	*this = other;

	return(true);
}

uint32_t PatriciaCursor :: findLeaf() {
	const unsigned char *p = ptr;
	uint16_t len = this->len;
	uint32_t data;

	do {
		// Skip to reference to current node's data or second child.
		p += (len + 7) / 8;

		while(len & 7) {
			// Read length from beginning of first child
			// (just after the data reference).
			len = p[3];
			// Skip current node's data or second child reference, the first child's
			// length and its contents, moving to its data or second child reference.
			p += (len + 7) / 8 + 4;
		}

		len = p[3];
		found = p;
		data = getData();

		p += 4;
		// After splitting nodes at 32 chars, avoid returning a split node.
	} while(data == Patricia :: notFound && !(*p & 0x80));

	return(data);
}

uint32_t PatriciaCursor :: getData() {
	if(!found) return(Patricia :: notFound);

	return( (found[0] << 16) + (found[1] << 8) + found[2] & Patricia :: idMask );
}
