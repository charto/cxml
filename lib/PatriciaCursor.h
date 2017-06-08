#pragma once

#include <cstdint>

#include "Patricia.h"

/** Cursor for finding a string in the trie, in steps of one character. */
class PatriciaCursor {

public:

	/** Start scanning a trie from the first input character. */
	void init(const Patricia &trie);

	/** Try to match previous input using a different trie. On failure,
	  * the cursor remains unchanged. */
	bool transfer(const Patricia &trie);

	/** Advance to the next input character, updating pointer to any associated
	  * value found. */
	bool advance(unsigned char c);

	/** Find the ID of the (lexicographically) first descendant leaf
	  * after advance has failed. The cursor position is unchanged. */
	uint32_t findLeaf();

	/** Get the data value associated with the string.
	  * Valid values are from 0 to 0x7ffffe and 0x7fffff indicates no data.
	  * Values are 3 bytes and the highest bit is an internal flag whether
	  * the trie node has no children. */
	uint32_t getData();

private:

	const unsigned char *root = nullptr;
	const unsigned char *ptr = nullptr;
	const unsigned char *found;
	uint16_t len;

	/** Handle to the JavaScript buffer with inserted data,
	  * to prevent garbage collecting it too early. */
	nbind::Buffer buffer;

};
