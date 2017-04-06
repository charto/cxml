#include <cstdio>

#include "Parser.h"

#ifndef DEBUG_PARTIAL_NAME_RECOVERY
#	define DEBUG_PARTIAL_NAME_RECOVERY 0
#endif

unsigned char whiteCharTbl[256];
unsigned char nameStartCharTbl[256];
unsigned char nameCharTbl[256];

Parser :: Parser(std::shared_ptr<ParserConfig> config) : config(config) {
	namespaceList = new const Namespace *[config->namespaceList.size()];
	const Namespace **ns = namespaceList;

	// Copy shared namespace pointers from config for faster access.
	// We hold a shared pointer to the config object ensuring these remain valid.
	for(auto &nsShared : config->namespaceList) {
		*ns++ = nsShared.get();
	}

	state = State :: MATCH;
	pattern = "\xef\xbb\xbf\0";
	matchState = State :: BEFORE_TEXT;
	noMatchState = State :: BEFORE_TEXT;
	partialMatchState = State :: ERROR;
	pos = 0;
	row = 0;
	col = 0;
}

/** Branchless cursor position update based on UTF-8 input byte. Assumes
  * each codepoint is a separate character printed left to right. */
inline void Parser :: updateRowCol(unsigned char c) {
	col = (
		// If c is a tab, round col up to just before the next tab stop.
		(col | ((c != '\t') - 1 & 7)) +
		// Then increment col if c is not a UTF-8 continuation byte.
		((c & 0xc0) != 0x80)        // Equals: (( (c >> 6) | ~(c >> 7) ) & 1)
	) & (
		// Finally set col to zero if c is a line feed.
		(c == '\n') - 1             // Equals: (( (uint32_t(c) - '\n' - 1) &
									//           ~(uint32_t(c) - '\n'    )   ) >> 31) - 1
	);

	// Increment row if c is a line feed.
	row += (c == '\n');
}

void Parser :: debug(unsigned char c) {
	// unsigned int color = static_cast<unsigned int>(state);
	// printf("\e[%d;%dm%c", (color & 8) >> 3, 30 + (color & 7), c);
	// signed int bytes = printf("\e[%d;%dm%c", (color & 8) >> 3, 30 + (color & 7), c);
	// putchar(c);
}

/** Parse a chunk of incoming data.
  * For security from buffer overflow attacks, memory writes are only done in
  * writeToken which should be foolproof. */

bool Parser :: parse(nbind::Buffer chunk) {
	// printf("\e[0m\n\nPARSING CHUNK\n\n");

	size_t len = chunk.length();
	size_t ahead;
	const unsigned char *chunkBuffer = chunk.data();
	const unsigned char *p = chunkBuffer;
	unsigned char c, d;
	uint32_t id;

	// Indicate that no tokens inside the chunk were found yet.
	tokenList[0] = 0;
	uint32_t *tokenPtr = tokenList + 1;

	tokenStart = p;

	// Read a byte of input.
	c = *p++;
	updateRowCol(c);

	/*
		This loop represents a DFA (deterministic finite automaton) where
		top-level switch case labels represent states. Goto and continue
		statements allow changing states without consuming input
		(because input reading and loop condition test are at the end).

		Element and attribute names and values, text and comments use an
		additional tighter inner loop for speed.

		Some duplicated states are avoided using the after<Name>State variables,
		which allow execution to jump to a common state and back again.
	*/

	while(1) {
		switch(state) {

			// Parser start state at the beginning of input,
			// when pattern is a UTF-8 BOM.
			case State :: MATCH:
			case State :: MATCH_SPARSE: MATCH_SPARSE:

				d = pattern[pos];

				if(!d) {
					state = matchState;
					pos = 0;
					continue;
				} else if(c == d) {
					++pos;
					break;
				} else if(state == State :: MATCH_SPARSE && whiteCharTbl[c]) {
					break;
				} else {
					state = pos ? partialMatchState : noMatchState;
					pos = 0;
					continue;
				}

			// State at the beginning of input after a possible UTF-8 BOM,
			// or after any closing tag.
			// Skip whitespace and then read text up to an opening tag.
			case State :: BEFORE_TEXT:

				if(whiteCharTbl[c]) break;

				if(c == '<') {
					state = State :: AFTER_LT;
					break;
				}

				textEndChar = '<';
				afterTextState = State :: AFTER_LT;

				textTokenType = TokenType :: TEXT_START_OFFSET;
				state = State :: TEXT;
				// Avoid consuming the first character.
				goto TEXT;

			// Read text, which can be an attribute value or a text node,
			// until textEndChar (defined by a preceding state) is found.
			// TODO: Detect and handle numbers in a special way for speed?
			case State :: TEXT: TEXT:

				writeToken(textTokenType, p - chunkBuffer - 1, tokenPtr);

				// Fast inner loop for capturing text between elements
				// and in attribute values.
				// TODO: disallow invalid characters!
				// while(valueCharTbl[c]) {
				while(c != textEndChar) {
					// debug(c);

					if(!--len) return(true);
					c = *p++;
					updateRowCol(c);
				}

				writeToken(
					// End token ID is always one higher than the corresponding
					// start token ID.
					static_cast<TokenType>(static_cast<uint32_t>(textTokenType) + 1),
					p - chunkBuffer - 1,
					tokenPtr
				);

				state = afterTextState;
				break;

			// The previous character was a '<' starting a tag. The current
			// character determines what kind of tag.
			case State :: AFTER_LT:

				trie = &Namespace :: elementTrie;

				switch(c) {
					// An SGML declaration <! ... > or <![CDATA[ ... ]]>
					// or a comment <!-- ... -->
					case '!':

						state = State :: SGML_DECLARATION;
						break;

					// An SGML <? ... > or an XML <? ... ?> processing
					// instruction.
					case '?':

						afterNameState = State :: AFTER_PROCESSING_NAME;
						afterValueState = State :: AFTER_PROCESSING_VALUE;
						nameTokenType = TokenType :: PROCESSING_ID;

						state = State :: BEFORE_NAME;
						break;

					// A closing element </NAME > (no whitespace after '<').
					case '/':
						afterNameState = State :: AFTER_CLOSE_ELEMENT_NAME;
						nameTokenType = TokenType :: CLOSE_ELEMENT_ID;

						state = State :: BEFORE_NAME;
						break;

					// An element <NAME ... >. May be self-closing.
					default:
						afterNameState = State :: STORE_ELEMENT_NAME;
						afterValueState = State :: AFTER_ATTRIBUTE_VALUE;
						nameTokenType = TokenType :: OPEN_ELEMENT_ID;

						state = State :: BEFORE_NAME;
						// Avoid consuming the first character.
						goto BEFORE_NAME;
				}

				break;

			// Skip any whitespace before an element name. XML doesn't
			// actually allow any, so this state could be removed for
			// stricter parsing.
			/*
			case State :: BEFORE_ELEMENT_NAME: BEFORE_ELEMENT_NAME:

				if(whiteCharTbl[c]) break;

				state = State :: BEFORE_NAME;
				goto BEFORE_NAME;
			*/

			// -----------------------------------------
			// Element and attribute name parsing begins
			// -----------------------------------------

			// Start matching a name to known names in a Patricia trie.
			case State :: BEFORE_NAME: BEFORE_NAME:

				// The current character must be the valid first character of
				// an element or attribute name, anything else is an error.
				if(!nameStartCharTbl[c]) return(false);

				// Look for a ":" separator indicating a qualified name (starts
				// with a namespace prefix). If the entire name doesn't fit in
				// the input buffer, we first try to parse as a qualified name.
				// This is an optional lookup to avoid later reprocessing.
				for(ahead = 0; ahead < len && nameCharTbl[p[ahead]]; ++ahead) {}

/*
				// Prepare Patricia tree cursor for parsing.
				if(ahead >= len) {
					// Assume a namespace prefix, because a ":" separator
					// may be in the next input buffer chunk.
					cursor.init(prefixTrie);
				} else if(p[ahead] == ':') {
					// Name contains ":" so it starts with a namespace prefix.
					// fprintf(stderr, "PREFIX FOUND: %.*s\n", ahead + 1, p - 1);
					cursor.init(prefixTrie);
				} else {
					// Element or attribute name.
*/
					cursor.init(namespaceList[0]->*trie);
//				}

				tokenStart = p - 1;

				state = State :: MATCH_TRIE;
				afterMatchTrieState = State :: NAME;
				goto MATCH_TRIE;

			case State :: MATCH_TRIE: MATCH_TRIE:

				// Fast inner loop for matching to known element and attribute names.
				while(cursor.advance(c)) {
					// debug(c);

					if(!--len) {
						pos += p - tokenStart;
						return(true);
					}
					c = *p++;
					updateRowCol(c);
				}

				state = afterMatchTrieState;
				continue;

			case State :: NAME:

				if(c == ':') {
					// Test for an attribute "xmlns:..." defining a namespace
					// prefix.
					if(cursor.getData() == config->xmlnsToken) {
						// TODO: ensure this is inside an element, not a processing
						// instruction!
						state = State :: DEFINE_XMLNS_PREFIX;
						break;
					}

					// TODO: If matching a namespace, use it here. Otherwise,
					// reintepret token up to cursor as a namespace prefix.
					// cursor.init(namespaceList[0]->*trie);
					break;
				}

				if(!nameCharTbl[c]) {
					// If the whole name was matched, get associated reference.
					id = cursor.getData();

					if(id != Patricia :: notFound) {
						writeToken(nameTokenType, id, tokenPtr);

						knownName = true;
						pos = 0;
						state = afterNameState;
						continue;
					} else {
						// TODO: What now? Emit partial name?
					}
				}

				pos += p - tokenStart;

				// This name was not found in the Patricia trie, but if it was
				// a partial match then input was already consumed and possibly
				// list if the input buffer was drained. We may need to emit the
				// length of the matched part and any token starting with it,
				// to recover the complete name.
				emitPartialName(p, static_cast<size_t>(p - chunkBuffer), tokenPtr);

				id = Patricia :: notFound;
				pos = 0;
				state = State :: UNKNOWN_NAME;
				goto UNKNOWN_NAME;

			// From this part onwards, the name was not found in any applicable
			// Patricia trie.
			case State :: UNKNOWN_NAME: UNKNOWN_NAME:

				while(nameCharTbl[c]) {
					if(!--len) return(true);
					c = *p++;
					updateRowCol(c);
				}

				if(c == ':') {
					// TODO: Handle a so far undeclared namespace prefix.
					// It can be valid if there's a corresponding xmlns:...
					// attribute in the same element.
					break;
				}

				writeToken(
					static_cast<TokenType>(
						static_cast<uint32_t>(TokenType :: UNKNOWN_OPEN_ELEMENT_END_OFFSET) -
						static_cast<uint32_t>(TokenType :: OPEN_ELEMENT_ID) +
						static_cast<uint32_t>(nameTokenType)
					),
					p - chunkBuffer - 1,
					tokenPtr
				);

				knownName = false;
				state = afterNameState;
				continue;

			// ---------------------------------------
			// Element and attribute name parsing ends
			// ---------------------------------------

			case State :: STORE_ELEMENT_NAME:

				// Store element name ID (already output) to verify closing element.
				// TODO: Push to a stack and verify!
				idElement = id;

				state = State :: AFTER_ELEMENT_NAME;
				goto AFTER_ELEMENT_NAME;

			// Inside an element start tag with the name already parsed.
			case State :: AFTER_ELEMENT_NAME: AFTER_ELEMENT_NAME:

				switch(c) {
					case '/':

						writeToken(TokenType :: CLOSE_ELEMENT_ID, idElement, tokenPtr);

						expected = '>';
						nextState = State :: BEFORE_TEXT;
						otherState = State :: ERROR;

						state = State :: EXPECT;
						break;

					case '>':

						state = State :: BEFORE_TEXT;
						break;

					default:

						if(whiteCharTbl[c]) break;
						else {
							// First read an attribute name.
							state = State :: BEFORE_NAME;
							nameTokenType = TokenType :: ATTRIBUTE_ID;
							trie = &Namespace :: attributeTrie;

							// Then equals sign and opening double quote.
							afterNameState = State :: MATCH_SPARSE;
							pattern = "=\"";
							noMatchState = State :: ERROR;
							partialMatchState = State :: ERROR;

							// Finally text content up to closing double quote.
							matchState = State :: TEXT;
							textTokenType = TokenType :: ATTRIBUTE_START_OFFSET;
							textEndChar = '"';
							afterTextState = afterValueState;

							// Attribute name.
							goto BEFORE_NAME;
						}
				}

				break;

			case State :: AFTER_CLOSE_ELEMENT_NAME:
				if(c == '>') {
					state = State :: BEFORE_TEXT;
				} else if(!whiteCharTbl[c]) {
					return(false);
				}

				break;

			// ------------------------------
			// Attribute value parsing begins
			// ------------------------------

			// Enforce whitespace between attributes.
			case State :: AFTER_ATTRIBUTE_VALUE: AFTER_ATTRIBUTE_VALUE:

				switch(c) {
					case '/':
					case '>':

						// Switch states without consuming character.
						state = State :: AFTER_ELEMENT_NAME;
						goto AFTER_ELEMENT_NAME;

					default:

						if(whiteCharTbl[c]) {
							state = State :: AFTER_ELEMENT_NAME;
							break;
						} else {
							return(false);
						}
				}

				break;

			// Finished reading read an attribute name beginning "xmlns:".
			// Parse the namespace prefix it defines.
			case State :: DEFINE_XMLNS_PREFIX:

				afterNameState = State :: AFTER_XMLNS_NAME;
				// Prepare to emit the chosen namespace prefix.
				nameTokenType = TokenType :: XMLNS_ID;

				tokenStart = p - 1;

				// Prepare Patricia tree cursor for parsing an xmlns prefix.
				state = State :: MATCH_TRIE;
				cursor.init(prefixTrie);

				// TODO: Better use a state without handling of the : char.
				afterMatchTrieState = State :: NAME;
				goto MATCH_TRIE;

			case State :: AFTER_XMLNS_NAME:

				// If the name was unrecognized, flush tokens so JavaScript
				// updates the namespace prefix trie and this tokenizer can
				// recognize it in the future.
				if(!knownName) {
					flush(tokenPtr);
					// Assume JavaScript passed inserted token ID to
					// setPrefixTrie which sets idLast.
					id = idLast;
				}

				// Store index of namespace prefix in prefix mapping table
				// for assigning a new namespace uri.
				idPrefix = id;

				// TODO: need to match namespace URL instead of emitting the
				// attribute as-is.

				state = State :: MATCH_SPARSE;
				pattern = "=\"";
				noMatchState = State :: ERROR;
				partialMatchState = State :: ERROR;

				matchState = State :: BEFORE_VALUE;
				cursor.init(uriTrie);
				valueTokenType = TokenType :: URI_ID;
				// valueEndChar = '"';

				// TODO: Make sure we're not inside a processing instruction!
				afterValueState = State :: AFTER_XMLNS_URI;

				goto MATCH_SPARSE;

			case State :: BEFORE_VALUE:

				tokenStart = p - 1;

				state = State :: MATCH_TRIE;
				afterMatchTrieState = State :: VALUE;
				goto MATCH_TRIE;

			// Parse a value that should match a known set. Similar to
			// State :: NAME but reads up to and consumes a final double quote.
			case State :: VALUE:

				if(c == '"') {
					// If the whole value was matched, get associated reference.
					id = cursor.getData();

					if(id != Patricia :: notFound) {
						writeToken(valueTokenType, id, tokenPtr);

						knownName = true;
						pos = 0;
						state = afterValueState;
						break;
					} else {
						// TODO: What now? Emit partial name?
					}
				}

				pos += p - tokenStart;

				emitPartialName(p, static_cast<size_t>(p - chunkBuffer), tokenPtr);

				id = Patricia :: notFound;
				pos = 0;
				state = State :: UNKNOWN_VALUE;
				goto UNKNOWN_VALUE;

			case State :: UNKNOWN_VALUE: UNKNOWN_VALUE:

				// TODO: disallow invalid characters!
				// while(valueCharTbl[c]) {
				while(c != '"') {
					if(!--len) return(true);
					c = *p++;
					updateRowCol(c);
				}

				if(c != '"') {
					return(false);
				}

				writeToken(
					static_cast<TokenType>(
						static_cast<uint32_t>(TokenType :: UNKNOWN_OPEN_ELEMENT_END_OFFSET) -
						static_cast<uint32_t>(TokenType :: OPEN_ELEMENT_ID) +
						static_cast<uint32_t>(valueTokenType)
					),
					p - chunkBuffer - 1,
					tokenPtr
				);

				knownName = false;
				state = afterValueState;
				break;

			case State :: AFTER_XMLNS_URI:

				// If the value was unrecognized, flush tokens so JavaScript
				// updates the uri trie and this tokenizer can recognize it
				// in the future.
				if(!knownName) {
					flush(tokenPtr);
					// Assume JavaScript passed inserted token ID to
					// setPrefixTrie which sets idLast.
					id = idLast;
				}

				// Store index of namespace prefix in prefix mapping table
				// for assigning a new namespace uri.
				idPrefix = id;

				state = State :: AFTER_ATTRIBUTE_VALUE;
				goto AFTER_ATTRIBUTE_VALUE;

			// ----------------------------
			// Attribute value parsing ends
			// ----------------------------

			// Tag starting with <! (comment, cdata, entity definition...)
			case State :: SGML_DECLARATION:

				switch(c) {
					// TODO: <![CDATA[ non-xml data ]]>
					case '[':

						break;

					// <!-- comment -->
					case '-':

						expected = '-';
						nextState = State :: BEFORE_COMMENT;
						otherState = State :: ERROR;

						state = State :: EXPECT;
						break;

					case '>':

						state = State :: BEFORE_TEXT;
						break;

					// Ignore the declaration contents for now.
					default:

						break;
				}
				break;

			// Inside a processing instruction with the name already parsed.
			case State :: AFTER_PROCESSING_NAME: AFTER_PROCESSING_NAME:

				switch(c) {
					case '?':

						// End of an XML processing instruction.
						writeToken(TokenType :: PROCESSING_END_TYPE, 0, tokenPtr);

						expected = '>';
						nextState = State :: BEFORE_TEXT;
						otherState = State :: ERROR;

						state = State :: EXPECT;
						break;

					case '>':

						// End of an SGML processing instruction.
						writeToken(TokenType :: PROCESSING_END_TYPE, 1, tokenPtr);

						state = State :: BEFORE_TEXT;
						break;

					case '/':

						return(false);

					default:

						// Switch states without consuming character.
						state = State :: AFTER_ELEMENT_NAME;
						goto AFTER_ELEMENT_NAME;
				}

				break;

			// Enforce whitespace between processing instruction attributes.
			case State :: AFTER_PROCESSING_VALUE:

				switch(c) {
					case '?':
					case '>':

						// Switch states without consuming character.
						state = State :: AFTER_PROCESSING_NAME;
						goto AFTER_PROCESSING_NAME;

					default:

						if(whiteCharTbl[c]) {
							state = State :: AFTER_PROCESSING_NAME;
							break;
						} else {
							return(false);
						}
				}

				break;

			case State :: BEFORE_COMMENT:

				writeToken(TokenType :: COMMENT_START_OFFSET, p - chunkBuffer - 1, tokenPtr);

				state = State :: COMMENT;
				goto COMMENT;

			case State :: COMMENT: COMMENT:

				// Fast inner loop for skipping comments.
				while(c != '-') {
					// debug(c);

					if(!--len) return(true);
					c = *p++;
					updateRowCol(c);
				}

				pattern = "->";
				matchState = State :: AFTER_COMMENT;
				noMatchState = State :: COMMENT;
				partialMatchState = State :: COMMENT;

				state = State :: MATCH;
				break;

			// Note: the terminating "-->" is included in the output byte range.
			case State :: AFTER_COMMENT:

				writeToken(
					TokenType :: COMMENT_END_OFFSET,
					p - chunkBuffer - 1,
					tokenPtr
				);

				state = State :: BEFORE_TEXT;
				break;

			case State :: EXPECT:

				state = (c == expected) ? nextState : otherState;

				if(state == State :: ERROR) goto ERROR;
				break;

			case State :: ERROR: ERROR:

				return(false);

			default:

				break;
		}

		// debug(c);

		// Only read the next character at the end of the loop, to allow
		// reprocessing the same character (changing states without
		// consuming input) by using "continue".
		if(!--len) return(true);
		c = *p++;
		updateRowCol(c);
	}
}

inline void Parser :: emitPartialName(const unsigned char *p, size_t offset, uint32_t *&tokenPtr) {
	// Test if the number of characters consumed is more than one,
	// and more than past characters still left in the input buffer.
	// Otherwise we can still take the other, faster branch.
	if(pos > 1 && (pos > offset || DEBUG_PARTIAL_NAME_RECOVERY)) {
		// NOTE: This is a very rare and complicated edge case.
		// Test it with the debug flag to run it more often.

		// Emit part length.
		writeToken(TokenType :: PARTIAL_NAME_LEN, pos - 1, tokenPtr);
		// Emit the first descendant leaf node, which by definition
		// will begin with this name part (any descendant leaf would work).
		writeToken(TokenType :: PARTIAL_NAME_ID, cursor.findLeaf(), tokenPtr);
		// Emit the offset of the remaining part of the name.
		writeToken(TokenType :: UNKNOWN_START_OFFSET, offset - 1, tokenPtr);
	} else {
		// The consumed part of the name still remains in the
		// input buffer. Simply emit its starting offset.
		writeToken(TokenType :: UNKNOWN_START_OFFSET, offset - pos, tokenPtr);
	}
}

struct Init {
	Init() {
		const char *white = "\r\n\t ";
		const char *nameStartRanges =  "__AZaz\x80\xf7";
		const char *nameRanges = "..--09__AZaz\x80\xf7";
		const char *p;
		unsigned char c, e;

		for(unsigned int i = 0; i < 256; ++i) {
			whiteCharTbl[i] = 0;
			nameStartCharTbl[i] = 0;
			nameCharTbl[i] = 0;
		}

		p = white;
		while((c = *p++)) whiteCharTbl[c] = 1;

		p = nameStartRanges;
		while((c = *p++)) {
			e = *p++;
			while(c <= e) nameStartCharTbl[c++] = 1;
		}

		p = nameRanges;
		while((c = *p++)) {
			e = *p++;
			while(c <= e) nameCharTbl[c++] = 1;
		}
	}
};

Init init;

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(Parser) {
	construct<std::shared_ptr<ParserConfig> >();
	method(setTokenBuffer);
	method(setPrefixTrie);
	method(setUriTrie);
	getter(getRow);
	getter(getCol);
	method(parse);
}

#endif
