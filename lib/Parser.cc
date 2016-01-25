#include <cstdio>

#include "Parser.h"

#ifndef DEBUG_PREFIX_RECOVERY
#	define DEBUG_PREFIX_RECOVERY 0
#endif

unsigned char bom[] = { 0xef, 0xbb, 0xbf, 0 };
unsigned char whiteCharTbl[256];
unsigned char nameStartCharTbl[256];
unsigned char nameCharTbl[256];

Parser :: Parser(std::shared_ptr<ParserConfig> config) : config(config) {
	namespaceList = new const Namespace *[config->namespaceList.size()];
	const Namespace **ns = namespaceList;

	for(auto &nsShared : config->namespaceList) {
		*ns++ = nsShared.get();
	}

	state = State :: BEGIN;
	pos = 0;
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
	const unsigned char *chunkBuffer = chunk.data();
	const unsigned char *p = chunkBuffer;
	unsigned char c;
	uint32_t id;

	// Indicate that no tokens inside the chunk were found yet.
	tokenList[0] = 0;
	uint32_t *tokenPtr = tokenList + 1;

	tokenStart = p;

	// Read a byte of input.
	c = *p++;

	/*
		This loop represents a DFA (deterministic finite automaton) where
		top-level switch case labels represent states. Goto and continue
		statements allow changing states without consuming input
		(because input reading and loop condition test are at the end).

		Element and attribute names and values, text and comments use an
		additional tighter inner loop for speed.

		Some duplicated states are avoided using the nextState variable,
		which allows execution to jump to a shared state and back.
	*/

	while(1) {
		switch(state) {
			// Parser start state at the beginning of input.
			// Recognizes a UTF-8 BOM.
			case State :: BEGIN:

				if(c == bom[pos]) {
					++pos;
					break;
				} else if(pos > 0 && pos < 3) {
					// Invalid bom
					return(false);
				} else {
					state = State :: BEFORE_TEXT;
					goto BEFORE_TEXT;
				}

			// State at the beginning of input after a possible UTF-8 BOM,
			// or after any closing tag.
			// Skip whitespace and then read text up to an opening tag.
			case State :: BEFORE_TEXT: BEFORE_TEXT:

				if(whiteCharTbl[c]) break;

				if(c == '<') {
					state = State :: AFTER_LT;
					break;
				}

				expected = '<';
				nextState = State :: AFTER_LT;

				tokenType = TokenType :: TEXT_START_OFFSET;
				state = State :: TEXT;
				// Avoid consuming the first character.
				goto TEXT;

			// Read text, which can be an attribute value or a text node.
			// The variable "expected" set by a preceding state controls
			// which character terminates the text and moves to nextState.
			// Values are terminated by a '"' and text nodes by a '<'
			// character.
			// TODO: Detect and handle numbers in a special way for speed?
			case State :: TEXT: TEXT:

				writeToken(tokenType, p - chunkBuffer - 1, tokenPtr);

				// Fast inner loop for capturing text between elements
				// and in attribute values.
				while(c != expected) {
					// debug(c);

					if(!--len) return(true);
					c = *p++;
				}

				writeToken(
					// End token ID is always one higher than the corresponding
					// start token ID.
					static_cast<TokenType>(static_cast<uint32_t>(tokenType) + 1),
					p - chunkBuffer - 1,
					tokenPtr
				);

				state = nextState;
				break;

			// The previous character was a '<' starting a tag. The current
			// character determines what kind of tag.
			case State :: AFTER_LT:

				switch(c) {
					// An SGML declaration <! ... > or <![CDATA[ ... ]]>
					// or a comment <!-- ... -->
					case '!':

						state = State :: SGML_DECLARATION;
						break;

					// An SGML <? ... > or an XML <? ... ?> processing
					// instruction.
					case '?':

						nextState = State :: AFTER_PROCESSING_NAME;
						afterValueState = State :: AFTER_PROCESSING_VALUE;
						tokenType = TokenType :: PROCESSING_ID;

						// Stricter, disallow whitespace after '<?':
						// state = State :: EXPECT_ELEMENT_NAME;
						state = State :: BEFORE_ELEMENT_NAME;

						break;

					// A closing element </NAME > (no whitespace after '<').
					case '/':
						nextState = State :: AFTER_CLOSE_ELEMENT_NAME;
						tokenType = TokenType :: CLOSE_ELEMENT_ID;

						// Stricter, disallow whitespace after '/':
						// state = State :: EXPECT_ELEMENT_NAME;
						state = State :: BEFORE_ELEMENT_NAME;
						break;

					// An element <NAME ... >. May be self-closing.
					default:
						nextState = State :: STORE_ELEMENT_NAME;
						afterValueState = State :: AFTER_ATTRIBUTE_VALUE;
						tokenType = TokenType :: OPEN_ELEMENT_ID;

						// Stricter, disallow whitespace after '<':
						// state = State :: EXPECT_ELEMENT_NAME;
						state = State :: BEFORE_ELEMENT_NAME;
						// Avoid consuming the first character.
						goto BEFORE_ELEMENT_NAME;
				}

				break;

			// Skip any whitespace before an element name. XML doesn't
			// actually allow any, so this state could be removed for
			// stricter parsing.
			case State :: BEFORE_ELEMENT_NAME: BEFORE_ELEMENT_NAME:

				if(whiteCharTbl[c]) break;

				state = State :: EXPECT_ELEMENT_NAME;
				goto EXPECT_ELEMENT_NAME;

			// The current character must be the valid first character of an
			// element or attribute name, anything else is an error.
			// Start matching the name to known names in a Patricia trie.
			case State :: EXPECT_ELEMENT_NAME: EXPECT_ELEMENT_NAME:

				// Prepare Patricia tree cursor for parsing an element name.
				// TODO: Use correct namespace ID.
				cursor.init(namespaceList[0]->elementTrie);

				if(!nameStartCharTbl[c]) return(false);

				tokenStart = p - 1;
				pos = 0;
				if(!cursor.advance(c)) goto BEFORE_PREFIX;

				// Element name.
				state = State :: NAME;
				break;

			case State :: NAME:

				// Fast inner loop for capturing element and attribute names.
				while(nameCharTbl[c]) {
					// Match the name, or output the prefix matched so far.
					if(!cursor.advance(c)) goto BEFORE_PREFIX;

					// debug(c);

					if(!--len) {
						pos += p - tokenStart;
						return(true);
					}
					c = *p++;
				}

				id = cursor.getData();
				writeToken(tokenType, id, tokenPtr);

				state = nextState;
				continue;

			case State :: BEFORE_PREFIX: BEFORE_PREFIX:

				// This name was not found in the Patricia trie, but if it was
				// a partial match then input was already consumed and possibly
				// lost if the input buffer was drained.
				// We may need to emit the length of the matched prefix and
				// any token starting with it, to recover the complete name.

				pos += p - tokenStart;

				// Test if the number of characters consumed is more than one,
				// and more than past characters still left in the input buffer.
				// Otherwise we can still take the other, faster branch.
				if(pos > 1 && (pos > static_cast<size_t>(p - chunkBuffer) || DEBUG_PREFIX_RECOVERY)) {
					// NOTE: This is a very rare and complicated edge case.
					// Test it with the debug flag to run it more often.

					// Emit prefix length.
					writeToken(TokenType :: PREFIX_NAME_LEN, pos - 1, tokenPtr);
					// Emit the first descendant leaf node, which by definition
					// will begin with this prefix (any descendant leaf would work).
					writeToken(TokenType :: PREFIX_NAME_ID, cursor.findLeaf(), tokenPtr);
					// Emit the offset of the remaining part of the name.
					writeToken(TokenType :: UNKNOWN_START_OFFSET, p - chunkBuffer - 1, tokenPtr);
				} else {
					// The consumed part of the name still remains in the
					// input buffer. Just emit its starting offset.
					writeToken(TokenType :: UNKNOWN_START_OFFSET, p - chunkBuffer - pos, tokenPtr);
				}

				id = Patricia :: notFound;
				state = State :: UNKNOWN_NAME;
				break;

			case State :: UNKNOWN_NAME:

				while(nameCharTbl[c]) {
					if(!--len) return(true);
					c = *p++;
				}

				writeToken(
					static_cast<TokenType>(
						static_cast<uint32_t>(TokenType :: UNKNOWN_OPEN_ELEMENT_END_OFFSET) -
						static_cast<uint32_t>(TokenType :: OPEN_ELEMENT_ID) +
						static_cast<uint32_t>(tokenType)
					),
					p - chunkBuffer - 1,
					tokenPtr
				);

				state = nextState;
				continue;

			case State :: STORE_ELEMENT_NAME:

				// Store element name ID (already output) to verify closing element.
				// TODO: Push to a stack and verify!
				elementID = id;

				state = State :: AFTER_ELEMENT_NAME;
				goto AFTER_ELEMENT_NAME;

			case State :: AFTER_ELEMENT_NAME: AFTER_ELEMENT_NAME:

				switch(c) {
					case '/':

						writeToken(TokenType :: CLOSE_ELEMENT_ID, elementID, tokenPtr);

						expected = '>';
						nextState = State :: BEFORE_TEXT;
						otherState = State :: ERROR;

						state = State :: EXPECT;
						break;

					case '>':

						state = State :: BEFORE_TEXT;
						break;

					default:

						if(nameStartCharTbl[c]) {
							nextState = State :: AFTER_ATTRIBUTE_NAME;
							tokenType = TokenType :: ATTRIBUTE_ID;

							// Prepare Patricia tree cursor for parsing
							// an attribute name.
							// TODO: Use correct namespace ID.
							cursor.init(namespaceList[0]->attributeTrie);

							tokenStart = p - 1;
							pos = 0;
							if(!cursor.advance(c)) goto BEFORE_PREFIX;

							// Attribute name.
							state = State :: NAME;
							break;
						} else if(whiteCharTbl[c]) {
							break;
						} else {
							return(false);
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

			case State :: AFTER_ATTRIBUTE_NAME:

				if(c == '=') {
					state = State :: BEFORE_ATTRIBUTE_VALUE;
					break;
				} else if(!whiteCharTbl[c]) {
					return(false);
				}

				break;

			case State :: BEFORE_ATTRIBUTE_VALUE:

				if(c == '"') {
					expected = '"';
					nextState = afterValueState;

					tokenType = TokenType :: ATTRIBUTE_START_OFFSET;
					state = State :: TEXT;
				} else if(!whiteCharTbl[c]) {
					return(false);
				}

				break;

			// Enforce whitespace between attributes.
			case State :: AFTER_ATTRIBUTE_VALUE:

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
				}

				expected = '-';
				nextState = State :: COMMENT_ENDING;
				otherState = State :: COMMENT;

				state = State :: EXPECT;
				break;

			// Note: the terminating "--" is included in the output byte range.
			case State :: COMMENT_ENDING:

				if(c == '>') {
					writeToken(
						TokenType :: COMMENT_END_OFFSET,
						p - chunkBuffer - 1,
						tokenPtr
					);
					state = State :: BEFORE_TEXT;
				} else {
					state = State :: COMMENT;
				}

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
	}
}

struct Init {
	Init() {
		const char *white = "\r\n\t ";
		const char *nameStartRanges =  "::__AZaz\x80\xf7";
		const char *nameRanges = "..--09::__AZaz\x80\xf7";
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
	method(parse);
}

#endif
