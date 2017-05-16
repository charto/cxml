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

struct Element {

	uint32_t prefixStackOffset;
	// TODO: verify open and close tags match by using CRC.
	uint32_t crc32;

};

/** Fast streaming XML parser. */

class Parser {

public:

	static constexpr uint32_t namespacePrefixTblSize = ParserConfig :: namespacePrefixTblSize;

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
		ELEMENT,
		ELEMENT_NAMESPACE,
		ATTRIBUTE,
		ATTRIBUTE_NAMESPACE,
		PROCESSING
	};

	static constexpr unsigned int TOKEN_SHIFT = 5;

	#define export
	#define const
	#define enum enum class
	#define CodeType TokenType : uint32_t
	#include "../src/tokenizer/CodeType.ts"
	#undef export
	#undef const
	#undef enum
	#undef CodeType

	Parser(const ParserConfig &config);

	ParserConfig &getConfig() { return(config); }

	/** Parse a chunk of incoming data. */
	bool parse(nbind::Buffer chunk);

	void setCodeBuffer(nbind::Buffer tokenBuffer, nbind::cbFunction &flushTokens) {
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

	void setPrefix(uint32_t idPrefix) {
		if(idPrefix < namespacePrefixTblSize) this->idPrefix = idPrefix;
	}

	bool bindPrefix(uint32_t idPrefix, uint32_t uri) {
		if(config.bindPrefix(idPrefix, uri)) {
			// Push old prefix binding to stack, to restore it after closing tag.
			// prefixStack.push_back(std::make_pair(idPrefix, namespacePrefixTbl[idPrefix]));
			return(true);
		}

		return(false);
	}

	bool addUri(uint32_t uri, uint32_t idNamespace);

	// Emit content for a partially matched token.
	// If the input buffer was drained, emit the match length and some
	// valid token beginning identically, to recover the complete name.
	inline void emitPartialName(
		const unsigned char *p,
		size_t offset,
		TokenType tokenType,
		uint32_t *&tokenPtr
	);

	inline void updateRowCol(unsigned char c);

	inline uint32_t getRow() { return(row); }
	inline uint32_t getCol() { return(col); }

	ParserConfig config;

	std::pair<uint32_t, const Namespace *> ns;

	std::vector<std::pair<uint32_t, const Namespace *> > prefixStack;
	std::vector<Element> elementStack;

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
	uint32_t idPrefix;
	uint32_t idNamespace;

	uint32_t idElement;

	TokenType nameTokenType;
	TokenType textTokenType;
	TokenType valueTokenType;
	const unsigned char *tokenStart;

	// TODO: Maybe this could be std::function<void ()>
	std::unique_ptr<nbind::cbFunction> flushTokens;

	Patricia Namespace :: *trie;

	nbind::Buffer tokenBuffer;
	uint32_t *tokenList;
	const uint32_t *tokenBufferEnd;

};
