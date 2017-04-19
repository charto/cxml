#pragma once

#include <vector>

#include <nbind/api.h>

#include "Namespace.h"
#include "PatriciaCursor.h"
#include "ParserConfig.h"

struct ParserState {

	/** Flag whether the opening tag had a namespace prefix. */
	bool isQualified;
	/** Namespace of this element. */
	Namespace *nsElement;
	/** Default xmlns before entering this element. */
	Namespace *nsOuterDefault;
	/** Number of new xmlns mappings made by this element. */
	uint32_t xmlnsMapCount;

};

/** Fast streaming XML parser. */

class Parser {

public:

	static constexpr uint32_t namespacePrefixTblSize = 256;

	/** Parser states. */

	enum class State : uint32_t {
		BEGIN,
		MATCH, MATCH_SPARSE,
		BEFORE_TEXT, TEXT,
		AFTER_LT,
		BEFORE_NAME, MATCH_TRIE, NAME, UNKNOWN_NAME,
		STORE_ELEMENT_NAME, AFTER_ELEMENT_NAME,
		AFTER_CLOSE_ELEMENT_NAME,
		BEFORE_ATTRIBUTE_VALUE, AFTER_ATTRIBUTE_VALUE,
		DEFINE_XMLNS_BEFORE_PREFIX_NAME, DEFINE_XMLNS_AFTER_PREFIX_NAME,
		BEFORE_VALUE, VALUE, UNKNOWN_VALUE, DEFINE_XMLNS_AFTER_URI,
		SGML_DECLARATION,
		AFTER_PROCESSING_NAME, AFTER_PROCESSING_VALUE,
		BEFORE_COMMENT, COMMENT, AFTER_COMMENT,
		EXPECT,
		ERROR
	};

	enum class TagType : uint32_t {
		ELEMENT,
		SGML_DECLARATION,
		PROCESSING
	};

	enum class MatchTarget : uint32_t {
		NAMESPACE,
		ELEMENT,
		ATTRIBUTE,
		PROCESSING
	};

	static constexpr unsigned int TOKEN_SHIFT = 5;

	// TODO: cdata start/end (no entity parsing on JS side)
	// Namespace shorthand declaration start/end
	// Namespace URI start / end ??? (could be handled as an attribute value)
	enum class TokenType : uint32_t {
		OPEN_ELEMENT_ID = 0,
		CLOSE_ELEMENT_ID,
		ATTRIBUTE_ID,
		PROCESSING_ID,
		XMLNS_ID,
		URI_ID,

		ELEMENT_EMITTED,
		CLOSED_ELEMENT_EMITTED,

		ATTRIBUTE_START_OFFSET,
		ATTRIBUTE_END_OFFSET,

		TEXT_START_OFFSET,
		TEXT_END_OFFSET,

		COMMENT_START_OFFSET,
		COMMENT_END_OFFSET,

		// Unrecognized element name.
		UNKNOWN_START_OFFSET,

		// The order of these must match OPEN_ELEMENT_ID, CLOSE_ELEMENT_ID...
		UNKNOWN_OPEN_ELEMENT_END_OFFSET,
		UNKNOWN_CLOSE_ELEMENT_END_OFFSET,
		UNKNOWN_ATTRIBUTE_END_OFFSET,
		UNKNOWN_PROCESSING_END_OFFSET,
		UNKNOWN_XMLNS_END_OFFSET,
		UNKNOWN_URI_END_OFFSET,

		PROCESSING_END_TYPE,

		// Recognized part from an unrecognized name.
		PARTIAL_LEN,
		PARTIAL_NAME_ID
	};

	Parser(std::shared_ptr<ParserConfig> config);

	/** Parse a chunk of incoming data. */
	bool parse(nbind::Buffer chunk);

	void setTokenBuffer(nbind::Buffer tokenBuffer, nbind::cbFunction &flushTokens) {
		this->flushTokens = std::unique_ptr<nbind::cbFunction>(new nbind::cbFunction(flushTokens));
		this->tokenBuffer = tokenBuffer;

		tokenList = reinterpret_cast<uint32_t *>(tokenBuffer.data());
		tokenBufferEnd = tokenList + tokenBuffer.length() / 4;
	}

	inline void flush(uint32_t *&tokenPtr) {
		(*flushTokens)();
		tokenList[0] = 0;
		tokenPtr = tokenList + 1;
	}

	/** Output a token. This is the only function writing to memory, so safety
	  * from code execution exploits depends on this and nothing else. */

	inline void writeToken(TokenType kind, uint32_t token, uint32_t *&tokenPtr) {
		if(tokenPtr >= tokenBufferEnd) flush(tokenPtr);

		// Buffer content length is stored at its beginning.
		++tokenList[0];

		// This must never write outside the range
		// from tokenList to tokenBufferEnd (exclusive).
		*tokenPtr++ = static_cast<uint32_t>(kind) + (token << TOKEN_SHIFT);
	}

	void setPrefixTrie(nbind::Buffer buffer, uint32_t id) {
		prefixTrie.setBuffer(buffer);
		idLast = id;
	}

	void setUriTrie(nbind::Buffer buffer, uint32_t id) {
		uriTrie.setBuffer(buffer);
		idLast = id;
	}

	uint32_t addNamespace(const std::shared_ptr<Namespace> ns) {
		extraNamespaceList.push_back(ns);
		return(extraNamespaceList.size() - 1);
	}

	bool addUri(uint32_t uri, uint32_t ns);

	inline void emitPartialName(const unsigned char *p, size_t offset, uint32_t *&tokenPtr);

	inline void updateRowCol(unsigned char c);

	inline uint32_t getRow() { return(row); }
	inline uint32_t getCol() { return(col); }

	std::shared_ptr<ParserConfig> config;

	const Namespace *namespacePrefixTbl[namespacePrefixTblSize];

	std::vector<const std::shared_ptr<Namespace>> extraNamespaceList;

	std::vector<const Namespace *> namespaceByUriToken;

	PatriciaCursor cursor;

	const char *pattern;

	State state;
	State matchState;
	State noMatchState;
	State partialMatchState;
	State afterNameState;
	State afterTextState;
	State afterMatchTrieState;
	/** Next state after reading an element, attribute or processing instruction
	  * name, a text node or an attribute value. */
	State nextState;
	/** Next state if the current character was not the expected one. */
	State otherState;
	/** Next state after reading an attribute value. Regular elements and
	  * processing instructions need different handling. */
	State afterValueState;
	/** Flag whether the previously emitted name was found in a trie. */
	bool knownName;

	TagType tagType;
	MatchTarget matchTarget;

	unsigned char textEndChar;

	/** Expected character for moving to another state. */
	unsigned char expected;

	size_t pos;

	uint32_t row;
	uint32_t col;

	uint32_t idToken;
	uint32_t idLast;
	uint32_t idPrefix;

	uint32_t idElement;

	TokenType nameTokenType;
	TokenType textTokenType;
	TokenType valueTokenType;
	const unsigned char *tokenStart;

	// TODO: Maybe this could be std::function<void ()>
	std::unique_ptr<nbind::cbFunction> flushTokens;

	Patricia Namespace :: *trie;

	Patricia prefixTrie;
	Patricia uriTrie;
	nbind::Buffer tokenBuffer;
	uint32_t *tokenList;
	const uint32_t *tokenBufferEnd;

};
