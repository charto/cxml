#include <cstring>
#include <cstdio>

#include "Parser.h"

#ifndef DEBUG_PARTIAL_NAME_RECOVERY
#	define DEBUG_PARTIAL_NAME_RECOVERY 0
#endif

unsigned char whiteCharTbl[256];
unsigned char valueCharTbl[256];
unsigned char xmlNameStartCharTbl[256];
unsigned char xmlNameCharTbl[256];
unsigned char dtdNameCharTbl[256];

Parser :: Parser(const ParserConfig &config) : config(config) {
	state = State :: MATCH;
	nameCharTbl = xmlNameCharTbl;
	nameStartCharTbl = xmlNameStartCharTbl;
	pattern = "\xef\xbb\xbf";
	matchState = State :: BEFORE_TEXT;
	noMatchState = State :: BEFORE_TEXT;
	partialMatchState = State :: PARSE_ERROR;
	pos = 0;
	row = 0;
	col = 0;
	sgmlNesting = 0;
}

/** Branchless cursor position update based on UTF-8 input byte. Assumes
  * each codepoint is a separate character printed left to right. */
inline void Parser :: updateRowCol(unsigned char c) {
#if 0
	unsigned int color = static_cast<unsigned int>(state);
	printf("\e[%d;%dm%c", (color & 8) >> 3, 30 + (color & 7), c);
#endif
	col = (
		// If c is a tab, round col up to just before the next tab stop.
		(col | (((c != '\t') - 1) & 7)) +
		// Then increment col if c is not a UTF-8 continuation byte.
		((c & 0xc0) != 0x80)
	) & (
		// Finally set col to zero if c is a line feed.
		(c == '\n') - 1
	);

	// Increment row if c is a line feed.
	row += (c == '\n');
}

/** Parse a chunk of incoming data.
  * For security from buffer overflow attacks, memory writes are only done in
  * writeToken which should be foolproof. */

Parser :: ErrorType Parser :: parse(nbind::Buffer chunk) {
	size_t len = chunk.length();
	size_t ahead;
	const unsigned char *chunkBuffer = chunk.data();
	const unsigned char *p = chunkBuffer;
	unsigned char c, d = 0;
	const Namespace *ns;

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

			case State :: QUOTE:

				if(d == '"' && c == '\'') {
					textEndChar = '\'';
					state = matchState;
					break;
				} else {
					state = noMatchState;
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
				while(1) {
					if(!valueCharTbl[c]) {
						if(c == textEndChar) break;

						switch(c) {
							case '&':

								// TODO: handle entities here?
								break;

							case '"':
							case '\'':
							case '<':
							case '>':

								// TODO: Stricter parsing would ban these.
								break;

							case ']':

								if(sgmlNesting) {
									// Signal end of DTD embedded in DOCTYPE.
									writeToken(TokenType :: SGML_NESTED_END, 0, tokenPtr);
									--sgmlNesting;

									textEndChar = ']';
									afterTextState = State :: SGML_DECLARATION;
									continue;
								}
								break;

							default:

								// Disallow nonsense bytes.
								return(ErrorType :: INVALID_CHAR);
						}
					}

					updateRowCol(c);
					if(!--len) return(ErrorType :: OK);
					c = *p++;
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

			case State :: BEFORE_CDATA:

				writeToken(textTokenType, p - chunkBuffer - 1, tokenPtr);
				state = State :: CDATA;
				goto CDATA;

			// Note: the terminating "]]>" is included in the output byte range.
			case State :: CDATA: CDATA:

				while(1) {
					if(c == ']') {
						++pos;
					} else if(c == '>' && pos >= 2) {
						break;
					} else {
						pos = 0;
					}

					updateRowCol(c);
					if(!--len) return(ErrorType :: OK);
					c = *p++;
				}

				writeToken(
					// End token ID is always one higher than the corresponding
					// start token ID.
					static_cast<TokenType>(static_cast<uint32_t>(textTokenType) + 1),
					p - chunkBuffer,
					tokenPtr
				);

				pos = 0;
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

						tagType = TagType :: ELEMENT;
						state = State :: BEFORE_SGML;
						break;

					// An SGML <? ... > or an XML <? ... ?> processing
					// instruction.
					case '?':

						afterNameState = State :: AFTER_PROCESSING_NAME;
						afterValueState = State :: AFTER_PROCESSING_VALUE;
						nameTokenType = TokenType :: OPEN_ELEMENT_ID;

						tagType = TagType :: PROCESSING;
						matchTarget = MatchTarget :: ELEMENT;

						// Put unknown processing instructions in a placeholder namespace.
						elementPrefix.idPrefix = config.processingPrefixToken;
						elementPrefix.idNamespace = config.namespacePrefixTbl[config.processingPrefixToken].first;
						memberPrefix = &elementPrefix;

						ns = config.namespacePrefixTbl[config.processingPrefixToken].second;

						cursor.init(ns->*trie);

						tokenStart = p;

						state = State :: MATCH_TRIE;
						afterMatchTrieState = State :: NAME;
						break;

					// A closing element </NAME > (no whitespace after '<').
					case '/':
						afterNameState = State :: AFTER_CLOSE_ELEMENT_NAME;
						nameTokenType = TokenType :: CLOSE_ELEMENT_ID;

						tagType = TagType :: ELEMENT;
						matchTarget = MatchTarget :: ELEMENT;
						state = State :: BEFORE_NAME;
						break;

					// An element <NAME ... >. May be self-closing.
					default:
						afterNameState = State :: STORE_ELEMENT_NAME;
						afterValueState = State :: AFTER_ATTRIBUTE_VALUE;
						nameTokenType = TokenType :: OPEN_ELEMENT_ID;
						memberPrefix = &elementPrefix;

						tagType = TagType :: ELEMENT;
						matchTarget = MatchTarget :: ELEMENT;
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
				if(!nameStartCharTbl[c]) {
					return(ErrorType :: INVALID_CHAR);
				}

				// Look for a ":" separator indicating a qualified name (starts
				// with a namespace prefix). If the entire name doesn't fit in
				// the input buffer, we first try to parse as a qualified name.
				// This is an optional lookup to avoid later reprocessing.
				for(ahead = 0; ahead + 1 < len && nameCharTbl[p[ahead]]; ++ahead) {}

				if(matchTarget == MatchTarget :: ELEMENT) {
					elementPrefix.idPrefix = config.emptyPrefixToken;
					elementPrefix.idNamespace = config.namespacePrefixTbl[config.emptyPrefixToken].first;
					ns = config.namespacePrefixTbl[config.emptyPrefixToken].second;
				} else {
					// By default, attributes belong to the same namespace as their parent element.
					attributePrefix.idPrefix = elementPrefix.idPrefix;
					attributePrefix.idNamespace = elementPrefix.idNamespace;
					ns = config.namespaceList[elementPrefix.idNamespace].get();
					// If element namespace prefix was known but undefined,
					// try the default namespace to allow matching the magic xmlns attribute.
					if(ns == nullptr) ns = config.namespacePrefixTbl[config.emptyPrefixToken].second;
				}

				// Prepare Patricia tree cursor for parsing.
				if(ahead + 1 >= len || p[ahead] == ':') {
					// If the input ran out, assume the name contains a colon
					// in the next input buffer chunk. If a colon is found, the
					// name starts with a namespace prefix.

					if(matchTarget == MatchTarget :: ELEMENT) {
						matchTarget = MatchTarget :: ELEMENT_NAMESPACE;
					} else {
						matchTarget = MatchTarget :: ATTRIBUTE_NAMESPACE;
					}
					cursor.init(config.prefixTrie);
				} else {
					if(ns == nullptr) {
						// No default namespace is defined, so this element
						// cannot be matched with anything.
						writeToken(TokenType :: PREFIX_ID, (memberPrefix->idNamespace << 14) | memberPrefix->idPrefix, tokenPtr);
						writeToken(TokenType :: UNKNOWN_START_OFFSET, p - 1 - chunkBuffer, tokenPtr);

						idToken = Patricia :: notFound;
						state = State :: UNKNOWN_NAME;
						goto UNKNOWN_NAME;
					}

					cursor.init(ns->*trie);
				}

				tokenStart = p - 1;

				state = State :: MATCH_TRIE;
				afterMatchTrieState = State :: NAME;
				goto MATCH_TRIE;

			case State :: MATCH_TRIE: MATCH_TRIE:

				// Fast inner loop for matching to known element and attribute names.
				while(cursor.advance(c)) {
					updateRowCol(c);
					if(!--len) {
						pos += p - tokenStart;
						return(ErrorType :: OK);
					}
					c = *p++;
				}

				state = afterMatchTrieState;
				continue;

			case State :: NAME:

				if(!nameCharTbl[c]) {
					// If the whole name was matched, get associated reference.
					idToken = cursor.getData();

					// Test for an attribute "xmlns:..." defining a namespace
					// prefix.

					if(tagType == TagType :: ELEMENT && (
						(
							matchTarget == MatchTarget :: ATTRIBUTE_NAMESPACE &&
							idToken == config.xmlnsPrefixToken
						) || (
							matchTarget == MatchTarget :: ATTRIBUTE &&
							idToken == config.xmlnsToken
						)
					)) {
						if(c == ':') {
							pos = 0;
							state = State :: DEFINE_XMLNS_BEFORE_PREFIX_NAME;
							break;
						} else {
							// Prepare to set the default namespace.
							nameTokenType = TokenType :: XMLNS_ID;
							afterNameState = State :: DEFINE_XMLNS_AFTER_PREFIX_NAME;
							idToken = config.emptyPrefixToken;
						}
					}

					if(idToken != Patricia :: notFound) {
						if(c == ':' && tagType == TagType :: ELEMENT) {
							// If matching a namespace, use it.
							if(
								matchTarget == MatchTarget :: ELEMENT_NAMESPACE ||
								matchTarget == MatchTarget :: ATTRIBUTE_NAMESPACE
							) {
								if(idToken >= namespacePrefixTblSize) {
									return(ErrorType :: TOO_MANY_PREFIXES);
								}

								memberPrefix->idPrefix = idToken;
								memberPrefix->idNamespace = config.namespacePrefixTbl[idToken].first;

								if(matchTarget == MatchTarget :: ELEMENT_NAMESPACE) {
									matchTarget = MatchTarget :: ELEMENT;
								} else {
									matchTarget = MatchTarget :: ATTRIBUTE;
								}

								ns = config.namespacePrefixTbl[idToken].second;

								if(ns == nullptr) {
									// Found a known but undeclared namespace
									// prefix, valid if declared with an xmlns
									// attribute in the same element.

									writeToken(TokenType :: PREFIX_ID, (memberPrefix->idNamespace << 14) | memberPrefix->idPrefix, tokenPtr);
									writeToken(TokenType :: UNKNOWN_START_OFFSET, p - chunkBuffer, tokenPtr);

									idToken = Patricia :: notFound;
									pos = 0;
									state = State :: UNKNOWN_NAME;
									break;
								}

								pos = 0;
								tokenStart = p;
								cursor.init(ns->*trie);

								state = State :: MATCH_TRIE;
								break;
							} else {
								// TODO: Reintepret token up to cursor as a
								// namespace prefix.
							}
							break;
						} else if(
							matchTarget == MatchTarget :: ELEMENT_NAMESPACE ||
							matchTarget == MatchTarget :: ATTRIBUTE_NAMESPACE
						) {
							// TODO: Reintepret token up to cursor as an
							// element or attribute name according to
							// nameTokenType.
						}

						if(nameTokenType != TokenType :: XMLNS_ID) {
							if(!updateElementStack(nameTokenType)) return(ErrorType :: OTHER);
							writeToken(TokenType :: PREFIX_ID, (memberPrefix->idNamespace << 14) | memberPrefix->idPrefix, tokenPtr);
						}
						writeToken(nameTokenType, idToken, tokenPtr);

						knownName = true;
						pos = 0;
						state = afterNameState;
						continue;
					} else {
						// TODO: Verify emitting partial name works in this case.
					}
				}

				pos += p - tokenStart;

				// For partial matches, emit the matched part of a name.
				emitPartialName(
					p,
					static_cast<size_t>(p - chunkBuffer),
					(
						matchTarget == MatchTarget :: ELEMENT ?
						TokenType :: PARTIAL_ELEMENT_ID : (
							matchTarget == MatchTarget :: ATTRIBUTE ?
							TokenType :: PARTIAL_ATTRIBUTE_ID :
							TokenType :: PARTIAL_PREFIX_ID
						)
					),
					tokenPtr
				);

				idToken = Patricia :: notFound;
				pos = 0;
				state = State :: UNKNOWN_NAME;
				goto UNKNOWN_NAME;

			// From this part onwards, the name was not found in any applicable
			// Patricia trie.
			case State :: UNKNOWN_NAME: UNKNOWN_NAME:

				while(nameCharTbl[c]) {
					updateRowCol(c);
					if(!--len) return(ErrorType :: OK);
					c = *p++;
				}

				if(c == ':' && tagType == TagType :: ELEMENT) {
					// Found a new, undeclared namespace prefix, valid if
					// declared with an xmlns attribute in the same element.

					writeToken(
						TokenType :: UNKNOWN_PREFIX_END_OFFSET,
						p - chunkBuffer - 1,
						tokenPtr
					);

					// Flush tokens to regenerate prefix trie in JavaScript.
					flush(tokenPtr);

					// Namespace is unknown so prepare to emit the name.
					writeToken(TokenType :: UNKNOWN_START_OFFSET, p - chunkBuffer, tokenPtr);
					break;
				}

				if(nameTokenType != TokenType :: XMLNS_ID) {
					if(!updateElementStack(nameTokenType)) return(ErrorType :: OTHER);
					writeToken(TokenType :: PREFIX_ID, (memberPrefix->idNamespace << 14) | memberPrefix->idPrefix, tokenPtr);
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
				idElement = idToken;

				state = State :: AFTER_ELEMENT_NAME;
				goto AFTER_ELEMENT_NAME;

			// Inside an element start tag with the name already parsed.
			case State :: AFTER_ELEMENT_NAME: AFTER_ELEMENT_NAME:

				switch(c) {
					case '/':

						if(!updateElementStack(TokenType :: CLOSE_ELEMENT_ID)) return(ErrorType :: OTHER);
						writeToken(TokenType :: CLOSED_ELEMENT_EMITTED, idElement, tokenPtr);

						expected = '>';
						nextState = State :: BEFORE_TEXT;
						otherState = State :: PARSE_ERROR;

						state = State :: EXPECT;
						break;

					case '>':

						writeToken(TokenType :: ELEMENT_EMITTED, idElement, tokenPtr);

						state = State :: BEFORE_TEXT;
						break;

					default:

						if(whiteCharTbl[c]) break;
						else {
							// First read an attribute name.
							state = State :: BEFORE_NAME;
							matchTarget = MatchTarget :: ATTRIBUTE;
							nameTokenType = TokenType :: ATTRIBUTE_ID;
							memberPrefix = &attributePrefix;
							trie = &Namespace :: attributeTrie;

							// Then equals sign and opening double quote.
							afterNameState = State :: MATCH_SPARSE;
							pattern = "=\"";
							noMatchState = State :: PARSE_ERROR;
							partialMatchState = State :: QUOTE;

							// Finally text content up to closing double quote.
							matchState = State :: TEXT;
							textTokenType = TokenType :: VALUE_START_OFFSET;
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
					return(ErrorType :: PROHIBITED_WHITESPACE);
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
							return(ErrorType :: INVALID_CHAR);
						}
				}

				break;

			// Finished reading an attribute name beginning "xmlns:".
			// Parse the namespace prefix it defines.
			case State :: DEFINE_XMLNS_BEFORE_PREFIX_NAME:

				tokenStart = p - 1;

				// Prepare Patricia tree cursor for parsing an xmlns prefix.
				state = State :: MATCH_TRIE;
				cursor.init(config.prefixTrie);

				// TODO: Better use a state without handling of the : char.
				afterMatchTrieState = State :: NAME;

				afterNameState = State :: DEFINE_XMLNS_AFTER_PREFIX_NAME;
				// Prepare to emit the chosen namespace prefix.
				nameTokenType = TokenType :: XMLNS_ID;

				goto MATCH_TRIE;

			case State :: DEFINE_XMLNS_AFTER_PREFIX_NAME:

				if(knownName) {
					// Store index of namespace prefix in prefix mapping table
					// for assigning a new namespace URI.
					idPrefix = idToken;
				} else {
					// If the name was unrecognized, flush tokens so JavaScript
					// updates the namespace prefix trie and this tokenizer can
					// recognize it in the future.
					flush(tokenPtr);
				}

				// Match equals sign and namespace URI in double quotes.
				state = State :: MATCH_SPARSE;
				pattern = "=\"";
				noMatchState = State :: PARSE_ERROR;
				partialMatchState = State :: QUOTE;

				matchState = State :: BEFORE_VALUE;
				cursor.init(config.uriTrie);
				valueTokenType = TokenType :: URI_ID;
				textEndChar = '"';

				afterValueState = State :: DEFINE_XMLNS_AFTER_URI;

				goto MATCH_SPARSE;

			case State :: BEFORE_VALUE:

				tokenStart = p - 1;

				state = State :: MATCH_TRIE;
				afterMatchTrieState = State :: VALUE;
				goto MATCH_TRIE;

			// Parse a value that should match a known set. Similar to
			// State :: NAME but reads up to and consumes a final double quote.
			case State :: VALUE:

				if(c == textEndChar) {
					// If the whole value was matched, get associated reference.
					idToken = cursor.getData();

					if(idToken != Patricia :: notFound) {
						if(valueTokenType == TokenType :: URI_ID) {
							valueTokenType = TokenType :: NAMESPACE_ID;
							idToken = config.namespaceByUriToken[idToken].first;
						}
						writeToken(valueTokenType, idToken, tokenPtr);

						knownName = true;
						pos = 0;
						state = afterValueState;
						break;
					} else {
						// TODO: Verify emitting partial name works in this case.
					}
				}

				pos += p - tokenStart;

				emitPartialName(
					p,
					static_cast<size_t>(p - chunkBuffer),
					TokenType :: PARTIAL_URI_ID,
					tokenPtr
				);

				idToken = Patricia :: notFound;
				pos = 0;
				state = State :: UNKNOWN_VALUE;
				goto UNKNOWN_VALUE;

			case State :: UNKNOWN_VALUE: UNKNOWN_VALUE:

				while(1) {
					if(!valueCharTbl[c]) {
						if(c == textEndChar) break;

						switch(c) {
							case '&':

								// TODO: Handle entities.
								break;

							case '"':
							case '\'':
							case '<':
							case '>':

								// TODO: Stricter parsing would ban these.
								break;

							case ']':

								break;

							default:

								// Disallow nonsense bytes.
								return(ErrorType :: INVALID_CHAR);
						}
					}

					updateRowCol(c);
					if(!--len) return(ErrorType :: OK);
					c = *p++;
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

			case State :: DEFINE_XMLNS_AFTER_URI:

				if(knownName) {
					bindPrefix(idPrefix, idToken);
				} else {
					// If the value was unrecognized, flush tokens so JavaScript
					// updates the uri trie and this tokenizer can recognize it
					// in the future.
					flush(tokenPtr);

					// Reset element namespace to correctly match any following attributes.
					elementPrefix.idNamespace = config.namespacePrefixTbl[elementPrefix.idPrefix].first;
				}

				afterValueState = State :: AFTER_ATTRIBUTE_VALUE;

				state = State :: AFTER_ATTRIBUTE_VALUE;
				goto AFTER_ATTRIBUTE_VALUE;

			// ----------------------------
			// Attribute value parsing ends
			// ----------------------------

			// Tag starting with <! (comment, cdata, entity definition...)
			case State :: BEFORE_SGML:

				switch(c) {
					case '[':

						pattern = "CDATA[";
						matchState = State :: BEFORE_CDATA;
						noMatchState = State :: PARSE_ERROR;
						partialMatchState = State :: PARSE_ERROR;

						textTokenType = TokenType :: CDATA_START_OFFSET;
						afterTextState = State :: BEFORE_TEXT;

						state = State :: MATCH;
						break;

					// <!-- comment -->
					case '-':

						expected = '-';
						nextState = State :: BEFORE_COMMENT;
						otherState = State :: PARSE_ERROR;

						state = State :: EXPECT;
						break;

					default:

						// writeToken(TokenType :: SGML_START, 0, tokenPtr);
						goto SGML_DECLARATION;
				}
				break;

			case State :: SGML_DECLARATION: SGML_DECLARATION:

				if(whiteCharTbl[c]) break;

				switch(c) {
					case '"':
					case '\'':

						textTokenType = TokenType :: SGML_TEXT_START_OFFSET;
						textEndChar = c;
						afterTextState = State :: SGML_DECLARATION;

						state = State :: TEXT;
						break;

					case '>':

						writeToken(TokenType :: SGML_EMITTED, 0, tokenPtr);

						nameCharTbl = xmlNameCharTbl;
						nameStartCharTbl = xmlNameStartCharTbl;

						state = State :: BEFORE_TEXT;
						break;

					default:

						matchTarget = MatchTarget :: ELEMENT;
						nameTokenType = TokenType :: SGML_ID;
						memberPrefix = &elementPrefix;

						nameCharTbl = dtdNameCharTbl;
						nameStartCharTbl = dtdNameCharTbl;
						afterNameState = State :: SGML_DECLARATION;

						state = State :: BEFORE_NAME;
						goto BEFORE_NAME;

					case '[':

						// Signal start of DTD embedded in DOCTYPE.
						writeToken(TokenType :: SGML_NESTED_START, 0, tokenPtr);
						++sgmlNesting;

						nameCharTbl = xmlNameCharTbl;
						nameStartCharTbl = xmlNameStartCharTbl;

						state = State :: BEFORE_TEXT;
						break;
				}
				break;

			// Inside a processing instruction with the name already parsed.
			case State :: AFTER_PROCESSING_NAME: AFTER_PROCESSING_NAME:

				switch(c) {
					case '?':

						// End of an XML processing instruction.
						// Handle like a self-closing element.
						c = '/';
						state = State :: AFTER_ELEMENT_NAME;
						goto AFTER_ELEMENT_NAME;

					case '>':

						// End of an SGML processing instruction.
						if(!updateElementStack(TokenType :: CLOSE_ELEMENT_ID)) return(ErrorType :: OTHER);
						writeToken(TokenType :: CLOSED_ELEMENT_EMITTED, idElement, tokenPtr);

						state = State :: BEFORE_TEXT;
						break;

					case '/':

						return(ErrorType :: INVALID_CHAR);

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
							return(ErrorType :: INVALID_CHAR);
						}
				}

				break;

			case State :: BEFORE_COMMENT:

				writeToken(TokenType :: COMMENT_START_OFFSET, p - chunkBuffer - 1, tokenPtr);

				state = State :: COMMENT;
				goto COMMENT;

			// Note: the terminating "-->" is included in the output byte range.
			case State :: COMMENT: COMMENT:

				while(1) {
					if(c == '-') {
						++pos;
					} else if(c == '>' && pos >= 2) {
						break;
					} else {
						pos = 0;
					}

					updateRowCol(c);
					if(!--len) return(ErrorType :: OK);
					c = *p++;
				}

				writeToken(
					TokenType :: COMMENT_END_OFFSET,
					p - chunkBuffer,
					tokenPtr
				);

				pos = 0;
				state = State :: BEFORE_TEXT;
				break;

			case State :: EXPECT:

				state = (c == expected) ? nextState : otherState;

				if(state == State :: PARSE_ERROR) goto PARSE_ERROR;
				break;

			case State :: PARSE_ERROR: PARSE_ERROR:

				return(ErrorType :: OTHER);

			default:

				break;
		}

		// Only read the next character at the end of the loop, to allow
		// reprocessing the same character (changing states without
		// consuming input) by using "continue".
		updateRowCol(c);
		if(!--len) return(ErrorType :: OK);
		c = *p++;
	}
}

inline void Parser :: emitPartialName(
	const unsigned char *p,
	size_t offset,
	TokenType tokenType,
	uint32_t *&tokenPtr
) {
	// Test if the number of characters consumed is more than one,
	// and more than past characters still left in the input buffer.
	// Otherwise we can still take the other, faster branch.
	if(pos > 1 && (pos > offset || DEBUG_PARTIAL_NAME_RECOVERY)) {
		// NOTE: This is a very rare and complicated edge case.
		// Test it with the debug flag to run it more often.

		uint32_t id = cursor.findLeaf();

		if(id != Patricia :: notFound) {
			// Emit part length.
			writeToken(TokenType :: PARTIAL_LEN, pos - 1, tokenPtr);
			// Emit the first descendant leaf node, which by definition
			// will begin with this name part (any descendant leaf would work).
			writeToken(tokenType, id, tokenPtr);
		}
		// Emit the offset of the remaining part of the name.
		writeToken(TokenType :: UNKNOWN_START_OFFSET, offset - 1, tokenPtr);
	} else {
		// The consumed part of the name still remains in the
		// input buffer. Simply emit its starting offset.
		writeToken(TokenType :: UNKNOWN_START_OFFSET, offset - pos, tokenPtr);
	}
}

struct Init {
	void setRange(unsigned char *tbl, const char *ranges, unsigned char flag) {
		unsigned char c, last;

		while((c = *ranges++)) {
			last = *ranges++;
			while(c <= last) tbl[c++] = flag;
		}
	}

	Init() {
		for(unsigned int i = 0; i <= 0xff; ++i) {
			whiteCharTbl[i] = 0;
			valueCharTbl[i] = (i >= ' ' && i <= 0xf7);
			xmlNameStartCharTbl[i] = 0;
			xmlNameCharTbl[i] = 0;
			dtdNameCharTbl[i] = 0;
		}

		for(unsigned char c : "\r\n\t ")    c && (valueCharTbl[c] = 1, whiteCharTbl[c] = 1);

		for(unsigned char c : "\"'&<>]\x7f") c && (valueCharTbl[c] = 0);

		setRange(xmlNameStartCharTbl,  "__AZaz\x80\xf7", 1);
		setRange(xmlNameCharTbl, "..--09__AZaz\x80\xf7", 1);
		setRange(dtdNameCharTbl, "##%%..--09__AZaz\x80\xf7", 1);
	}
};

Init init;

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_ALIAS(Parser :: ErrorType, int32_t);

NBIND_CLASS(Parser) {
	construct<const ParserConfig &>();
	method(getConfig);
	method(setCodeBuffer);
	method(setPrefix);
	method(bindPrefix);
	getter(getRow);
	getter(getCol);
	method(parse);
	method(destroy);
}

#endif
