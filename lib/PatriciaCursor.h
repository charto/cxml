#pragma once

#include <cstdint>

#include "Patricia.h"

/** Cursor for finding a string in the trie, in steps of one character. */
class PatriciaCursor {

public:

	/** Start scanning a trie from the first input character. */
	void init(const Patricia &trie) {
		ptr = trie.root;
		len = *ptr++;
	}

	/** Advance to the next input character, updating pointer to any associated
	  * value found. */
	bool advance(unsigned char c);

	/** Find the ID of any descendant leaf after advance has failed. */
	unsigned int findLeaf();

	/** Get the data value associated with the string.
	  * Valid values are from 0 to 0x7ffffe and 0x7fffff indicates no data.
	  * Values are 3 bytes and the highest bit is an internal flag whether
	  * the trie node has no children. */
	unsigned int getData();

private:

	const unsigned char *ptr = nullptr;
	const unsigned char *found;
	uint16_t len;

};
