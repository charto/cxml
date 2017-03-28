#pragma once

/*
	A trie node contains data and 4 extra bytes:

	- Length in bits (1 byte)
	- Data (1 - 32 bytes)
	- If state is accepted (can only have one child):
	  - Offset to data pointer (3 bytes)
	- If node has two children (cannot be an accepted state):
	  - Offset to other child (3 bytes)

	First child node immediately follows.

	Total data size is limited to 16 megabytes.
*/

/** Patricia trie. */

class Patricia {

	friend class PatriciaCursor;

public:

	Patricia() {}

	void setRoot(const unsigned char *root) { this->root = root; }

	static constexpr uint32_t notFound = 0x7fffff;
	static constexpr uint32_t idMask = 0x7fffff;

private:

	/** A separate tree root for each possible initial character. */
	const unsigned char *root;

};
