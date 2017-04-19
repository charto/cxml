import * as stream from 'stream';

import { ArrayType } from '../tokenizer/Buffer';
import { Patricia } from '../tokenizer/Patricia';
import { TokenSet } from '../tokenizer/TokenSet';
import { Token } from '../tokenizer/Token';
import { Namespace } from '../Namespace';

import { NativeParser } from './ParserLib';
import { ParserConfig } from './ParserConfig';

export type TokenBuffer = (number | Token | string)[];

// const codeBufferSize = 2;
// const codeBufferSize = 3;
const codeBufferSize = 8192;
const dynamicTokenTblSize = 256;

const chunkSize = Infinity;

const enum TOKEN {
	SHIFT = 5,
	MASK = 31
}

/** Copypasted from Parser.h. */
const enum CodeType {
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

	// Recognized prefix from an unrecognized name.
	PARTIAL_LEN,
	PARTIAL_NAME_ID
}

export const enum TokenType {
	// The placement of these must match equivalents in CodeType.
	OPEN_ELEMENT = 0,
	CLOSE_ELEMENT,
	ATTRIBUTE,
	PROCESSING,
	XMLNS,
	URI,

	// The placement of these must match equivalents in CodeType.
	ELEMENT_EMITTED,
	CLOSED_ELEMENT_EMITTED,

	VALUE,
	TEXT,

	COMMENT,

	UNKNOWN_OPEN_ELEMENT,
	UNKNOWN_CLOSE_ELEMENT,
	UNKNOWN_ATTRIBUTE,
	UNKNOWN_PROCESSING,

	XML_PROCESSING_END,
	SGML_PROCESSING_END
}

let tokenTypeTbl: TokenType[] = [];

// Make sure these codes match without the table:
// tokenTypeTbl[CodeType.OPEN_ELEMENT_ID] = TokenType.OPEN_ELEMENT;
// tokenTypeTbl[CodeType.CLOSE_ELEMENT_ID] = TokenType.CLOSE_ELEMENT;
// tokenTypeTbl[CodeType.ATTRIBUTE_ID] = TokenType.ATTRIBUTE;
// tokenTypeTbl[CodeType.PROCESSING_ID] = TokenType.PROCESSING;

tokenTypeTbl[CodeType.ATTRIBUTE_END_OFFSET] = TokenType.VALUE;
tokenTypeTbl[CodeType.TEXT_END_OFFSET] = TokenType.TEXT;
tokenTypeTbl[CodeType.COMMENT_END_OFFSET] = TokenType.COMMENT;

tokenTypeTbl[CodeType.UNKNOWN_OPEN_ELEMENT_END_OFFSET] = TokenType.UNKNOWN_OPEN_ELEMENT;
tokenTypeTbl[CodeType.UNKNOWN_CLOSE_ELEMENT_END_OFFSET] = TokenType.UNKNOWN_CLOSE_ELEMENT;
tokenTypeTbl[CodeType.UNKNOWN_ATTRIBUTE_END_OFFSET] = TokenType.UNKNOWN_ATTRIBUTE;
tokenTypeTbl[CodeType.UNKNOWN_PROCESSING_END_OFFSET] = TokenType.UNKNOWN_PROCESSING;
tokenTypeTbl[CodeType.UNKNOWN_XMLNS_END_OFFSET] = TokenType.XMLNS;
tokenTypeTbl[CodeType.UNKNOWN_URI_END_OFFSET] = TokenType.URI;

class TokenPackage {
	constructor(
		public native: NativeParser,
		public tokenSet: TokenSet,
		public trie: Patricia
	) {}

	add(name: string): [ Token, number ] {
		if(!this.isCloned) {
			// Copy tree on first write.
			this.tokenSet = this.tokenSet.clone();
			this.trie = this.trie.clone();
			this.isCloned = true;
		}

		const token = new Token(name);

		this.trie.insertNode(token);
		return([ token, this.tokenSet.add(token) ]);
	}

	isCloned = false;
}

export class Parser extends stream.Transform {
	constructor(config: ParserConfig) {
		super({ objectMode: true });

		this.native = config.createNativeParser();

		this.tokenSet = config.tokenSet;

		this.codeBuffer = new Uint32Array(codeBufferSize);
		this.native.setTokenBuffer(this.codeBuffer, () => this.parseCodeBuffer(true));

		this.prefixes = new TokenPackage(this.native, config.prefixSet, config.prefixTrie);
		// TODO: C++ side should just copy the tree from the config object.
		this.native.setPrefixTrie(this.prefixes.trie.encode(this.prefixes.tokenSet), 0);
		this.prefixList = this.prefixes.tokenSet.list;

		this.uris = new TokenPackage(this.native, config.uriSet, config.uriTrie);
		// TODO: C++ side should just copy the tree from the config object.
		this.native.setUriTrie(this.uris.trie.encode(this.uris.tokenSet), 0);
		this.uriList = this.uris.tokenSet.list;
	}

	_transform(chunk: string | Buffer, enc: string, flush: (err: any, chunk: TokenBuffer) => void) {
		this.chunk = chunk;
		this.flush = flush;
		this.getSlice = (typeof(chunk) == 'string') ? this.getStringSlice : this.getBufferSlice;

		this.tokenNum = 0;
		const len = chunk.length;
		let pos = 0;

		while(pos < len) {
			let next = Math.min(pos + chunkSize, len);

			this.chunk = chunk.slice(pos, next);
			this.native.parse(this.chunk as Buffer);
			this.parseCodeBuffer(false);

			pos = next;
		}

		this.tokenBuffer[0] = this.tokenNum;
		this.flush(null, this.tokenBuffer);
	}

	private parseCodeBuffer(pending: boolean) {
		const codeBuffer = this.codeBuffer;
		const codeCount = codeBuffer[0];

		let codeNum = 0;
		let partStart = this.partStart;
		let partialLen = this.partialLen;

		const tokenBuffer = this.tokenBuffer;
		const tokenList = this.tokenSet.list;
		let tokenNum = this.tokenNum;
		let token: Token;
		let id = 0;

		while(codeNum < codeCount) {
			let code = codeBuffer[++codeNum];
			const kind = code & TOKEN.MASK;
			code >>= TOKEN.SHIFT;

			switch(kind) {
				case CodeType.OPEN_ELEMENT_ID:
				case CodeType.CLOSE_ELEMENT_ID:
				case CodeType.ATTRIBUTE_ID:
				case CodeType.PROCESSING_ID:

					tokenBuffer[++tokenNum] = kind as TokenType;
					//if(!tokenList[code]) console.error(kind + ' ' + code);
					tokenBuffer[++tokenNum] = tokenList[code];
					break;

				case CodeType.XMLNS_ID:

					tokenBuffer[++tokenNum] = TokenType.XMLNS;
					tokenBuffer[++tokenNum] = this.prefixList[code];
					break;

				case CodeType.URI_ID:

					tokenBuffer[++tokenNum] = TokenType.URI;
					tokenBuffer[++tokenNum] = this.uriList[code];
					break;

				case CodeType.ELEMENT_EMITTED:
				case CodeType.CLOSED_ELEMENT_EMITTED:

					tokenBuffer[++tokenNum] = kind as TokenType;
					break;

				case CodeType.TEXT_START_OFFSET:
				case CodeType.ATTRIBUTE_START_OFFSET:
				case CodeType.COMMENT_START_OFFSET:
				case CodeType.UNKNOWN_START_OFFSET:

					partStart = code;
					break;

				case CodeType.COMMENT_END_OFFSET:

					tokenBuffer[++tokenNum] = TokenType.COMMENT;
					tokenBuffer[++tokenNum] = this.getSlice(partStart, code);
					partStart = -1;
					break;

				case CodeType.ATTRIBUTE_END_OFFSET:
				case CodeType.TEXT_END_OFFSET:
				case CodeType.UNKNOWN_OPEN_ELEMENT_END_OFFSET:
				case CodeType.UNKNOWN_CLOSE_ELEMENT_END_OFFSET:
				case CodeType.UNKNOWN_ATTRIBUTE_END_OFFSET:
				case CodeType.UNKNOWN_PROCESSING_END_OFFSET:

					tokenBuffer[++tokenNum] = tokenTypeTbl[kind];
					tokenBuffer[++tokenNum] = this.getSlice(partStart, code);
					partStart = -1;
					break;

				case CodeType.UNKNOWN_XMLNS_END_OFFSET:
				case CodeType.UNKNOWN_URI_END_OFFSET:

					// Add the namespace prefix or URI to a separate trie.
					// Incoming code buffer should have been flushed immediately
					// after writing this token.

					if(kind == CodeType.UNKNOWN_XMLNS_END_OFFSET) {
						[ token, id ] = this.prefixes.add(this.getSlice(partStart, code));

						if(id > dynamicTokenTblSize) {
							// TODO: report row and column in error messages.
							throw(new Error('Too many different xmlns prefixes'));
						}

						// Pass new trie and ID of last inserted token to C++.
						this.native.setPrefixTrie(this.prefixes.trie.encode(this.prefixes.tokenSet), id);
						this.prefixList = this.prefixes.tokenSet.list;
					} else {
						let uri = this.getSlice(partStart, code);

						[ token, id ] = this.uris.add(uri);

						if(id > dynamicTokenTblSize) {
							// TODO: report row and column in error messages.
							throw(new Error('Too many different xmlns URIs'));
						}

						// Create a new namespace for the unrecognized URI.
						this.native.addUri(
							id,
							this.native.addNamespace(
								new Namespace('', uri).getNative(this.tokenSet)
							)
						);

						// Pass new trie and ID of last inserted token to C++.
						this.native.setUriTrie(this.uris.trie.encode(this.uris.tokenSet), id);
						this.uriList = this.uris.tokenSet.list;
					}

					tokenBuffer[++tokenNum] = tokenTypeTbl[kind];
					tokenBuffer[++tokenNum] = token;
					partStart = -1;
					break;

				case CodeType.PARTIAL_LEN:

					partialLen = code;
					break;

				case CodeType.PARTIAL_NAME_ID:

					this.bufferPartList = [ tokenList[code].buf.slice(0, partialLen) as any ];
					this.partList = [ this.bufferPartList ];
					break;

				case CodeType.PROCESSING_END_TYPE:

					tokenBuffer[++tokenNum] = (
						code ?
						TokenType.SGML_PROCESSING_END :
						TokenType.XML_PROCESSING_END
					);
					break;

				default:

					break;
			}
		}

		if(!pending && partStart >= 0) {
			this.storeSlice(partStart);
			partStart = 0;
		}

		this.partStart = partStart;
		this.partialLen = partialLen;
		this.tokenNum = tokenNum;
	}

	private storeSlice(start: number, end?: number) {
		if(!this.partList) this.partList = [];

		if(typeof(this.chunk) == 'string') {
			this.bufferPartList = null;
			this.partList.push(this.chunk.substring(start, end));
		} else {
			if(!this.bufferPartList) {
				this.bufferPartList = [];
				this.partList.push(this.bufferPartList);
			}
			this.bufferPartList.push(this.chunk.slice(start, end));
		}
	}

	/** Get a string from the input buffer. Prepend any parts left from
	  * previous code buffers. */
	private getSlice: (start: number, end?: number) => string;

	/** Universal getSlice handler for concatenating buffer parts. */
	private buildSlice(start: number, end?: number) {
		this.storeSlice(start, end);

		const result = this.partList!.map((part: string | Buffer[]) =>
			typeof(part) == 'string' ? part : Buffer.concat(part).toString('utf-8')
		).join('');

		this.bufferPartList = null;
		this.partList = null;

		return(result);
	}

	/** Fast single-part getSlice handler for string buffers. */
	private getStringSlice(start: number, end?: number) {
		return((
			this.partList ? this.buildSlice(start, end) :
			this.chunk.slice(start, end) as string
		).replace(/\r\n?|\n\r/g, '\n'));
	}

	/** Fast single-part getSlice handler for Node.js Buffers. */
	private getBufferSlice(start: number, end?: number) {
		return((
			this.partList ? this.buildSlice(start, end) :
			(this.chunk as Buffer).toString('utf-8', start, end)
		).replace(/\r\n?|\n\r/g, '\n'));
	}

	private tokenSet: TokenSet;

	/** Current input buffer. */
	private chunk: string | Buffer;

	private flush: (err: any, chunk: TokenBuffer) => void;

	private bufferPartList: Buffer[] | null;
	/** Storage for parts of strings split between code or input buffers. */
	private partList: (string | Buffer[])[] | null;

	/** Offset to start of text in input buffer, or -1 if not reading text. */
	private partStart = -1;

	private partialLen: number;

	private tokenNum: number;

	private prefixes: TokenPackage;
	private prefixList: Token[];
	private uris: TokenPackage;
	private uriList: Token[];

	private native: NativeParser;
	private codeBuffer: Uint32Array;
	private tokenBuffer: TokenBuffer = [];
}
