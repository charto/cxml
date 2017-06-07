import * as stream from 'stream';

import { ArrayType, encodeArray, decodeArray, concatArray } from '../Buffer';
import { Namespace } from '../Namespace';
import { CodeType } from '../tokenizer/CodeType';
import { NativeParser } from './ParserLib';
import { ParserConfig } from './ParserConfig';
import { ParserNamespace } from './ParserNamespace';
import { InternalToken } from './InternalToken';
import { TokenSet } from '../tokenizer/TokenSet';
import { Token, TokenKind, SpecialToken, NamespaceToken, MemberToken, OpenToken, CloseToken, StringToken } from './Token';

export type TokenBuffer = (Token | number | string)[];

// const codeBufferSize = 2;
// const codeBufferSize = 3;
const codeBufferSize = 8192;

const chunkSize = Infinity;

const enum TOKEN {
	SHIFT = 5,
	MASK = 31
}

/** XML parser stream, emits tokens with fully qualified names. */

export class Parser extends stream.Transform {

	/** Call only from ParserConfig.createParser.
	  * @param config Reference to C++ config object.
	  * @param native Reference to C++ parser object. */
	constructor(private config: ParserConfig, private native: NativeParser) {
		super({ objectMode: true });

		this.codeBuffer = new Uint32Array(codeBufferSize);
		this.native.setCodeBuffer(this.codeBuffer, () => this.parseCodeBuffer(true));
	}

	public getConfig() { return(this.config); }

	private throwError(msg: string) {
		throw(new Error(msg));
	}

	_transform(
		chunk: string | ArrayType,
		enc: string,
		flush: (err: any, chunk: TokenBuffer | null) => void
	) {
		if(typeof(chunk) == 'string') chunk = encodeArray(chunk);
		this.flush = flush;

		const len = chunk.length;
		let next: number;

		for(let pos = 0; pos < len; pos = next) {
			next = Math.min(pos + chunkSize, len);

			this.chunk = chunk.slice(pos, next);
			this.native.parse(this.chunk) || this.throwError('Parse error');
			this.parseCodeBuffer(false);
		}

		if(this.elementStart < 0) {
			this.tokenBuffer[0] = this.tokenNum;
			this.tokenBuffer[1] = (
				this.namespacesChanged ?
				new NamespaceToken(this.namespaceList) :
				SpecialToken.blank
			);
			flush(null, this.tokenBuffer);
			this.tokenNum = 1;
		} else {
			// Not ready to flush but have to send something to get more input.
			flush(null, null);
		}
	}

	private parseCodeBuffer(pending: boolean) {
		const config = this.config;
		const codeBuffer = this.codeBuffer;
		const codeCount = codeBuffer[0];

		// NOTE: Remember to update these if config is cloned!
		const elementList = config.elementSpace.list;
		const attributeList = config.attributeSpace.list;
		const prefixList = config.prefixSpace.list;
		const uriList = config.uriSpace.list;

		let codeNum = 0;
		let partStart = this.partStart;
		let partialLen = this.partialLen;
		let latestElement = this.latestElement;
		let latestPrefix = this.latestPrefix;
		let latestNamespace = this.latestNamespace;

		const tokenBuffer = this.tokenBuffer;
		const prefixBuffer = this.prefixBuffer;
		const namespaceBuffer = this.namespaceBuffer;
		const unknownElementTbl = this.unknownElementTbl;
		const unknownAttributeTbl = this.unknownAttributeTbl;
		const unknownOffsetList = this.unknownOffsetList;
		// let partialList: InternalToken[];
		let tokenNum = this.tokenNum;
		let token: Token;
		let linkTbl: Token[];
		let linkKind: number;
		let name: string;
		let elementStart = this.elementStart;
		let unknownCount = this.unknownCount;

		while(codeNum < codeCount) {
			let code = codeBuffer[++codeNum];
			const kind = code & TOKEN.MASK;
			code >>= TOKEN.SHIFT;

			switch(kind) {
				case CodeType.OPEN_ELEMENT_ID:

					latestElement = elementList[code].open;
					// TODO: If latestprefix is null, use current prefix for element's namespace.
					tokenBuffer[++tokenNum] = latestElement;
					prefixBuffer[0] = latestPrefix;
					elementStart = tokenNum;
					break;

				case CodeType.CLOSE_ELEMENT_ID:

					tokenBuffer[++tokenNum] = elementList[code].close;
					break;

				case CodeType.ELEMENT_EMITTED:
				case CodeType.CLOSED_ELEMENT_EMITTED:

					if(unknownCount) {
						let ns: ParserNamespace;
						let offset: number;

						for(let pos = 0; pos < unknownCount; ++pos) {
							offset = unknownOffsetList[pos];
							ns = namespaceBuffer[offset]!;
							// If an xmlns definition already resolved
							// this token, ns will be null.
							if(ns) {
								tokenBuffer[offset + elementStart] = (
									tokenBuffer[offset + elementStart] as MemberToken
								).resolve(ns);
							}
						}

						latestElement = tokenBuffer[elementStart] as OpenToken;
						unknownCount = 0;
					}

					tokenBuffer[++tokenNum] = (
						kind == CodeType.ELEMENT_EMITTED ?
						latestElement.emitted :
						latestElement.close
					)

					elementStart = -1;

					break;

				case CodeType.ATTRIBUTE_ID:

					tokenBuffer[++tokenNum] = attributeList[code].string;
					// TODO: If latestprefix is null, use current prefix for attribute's namespace.
					prefixBuffer[tokenNum - elementStart] = latestPrefix;
					break;

				case CodeType.PROCESSING_ID:

					break;

				case CodeType.PREFIX_ID:

					latestNamespace = config.namespaceList[code >> 14];
					code = code & 0x3fff;

				// Fallthru
				case CodeType.XMLNS_ID:

					latestPrefix = prefixList[code];
					break;

				case CodeType.NAMESPACE_ID:

					this.resolve(elementStart, tokenNum, latestPrefix!, code);
					latestPrefix = null;
					break;

				case CodeType.TEXT_START_OFFSET:
				case CodeType.VALUE_START_OFFSET:
				case CodeType.COMMENT_START_OFFSET:
				case CodeType.UNKNOWN_START_OFFSET:

					partStart = code;
					break;

				case CodeType.UNKNOWN_OPEN_ELEMENT_END_OFFSET:

					name = this.getSlice(partStart, code);
					latestElement = unknownElementTbl[name];

					if(!latestElement) {
						latestElement = new OpenToken(name, Namespace.unknown);
						unknownElementTbl[name] = latestElement;
					}

					tokenBuffer[++tokenNum] = latestElement;
					prefixBuffer[0] = latestPrefix;
					namespaceBuffer[0] = latestNamespace;
					elementStart = tokenNum;
					unknownOffsetList[0] = 0;
					unknownCount = 1;
					break;

				case CodeType.UNKNOWN_CLOSE_ELEMENT_END_OFFSET:

					name = this.getSlice(partStart, code);
					tokenBuffer[++tokenNum] = latestNamespace!.addElement(name).close;
					break;

				case CodeType.UNKNOWN_ATTRIBUTE_END_OFFSET:

					name = this.getSlice(partStart, code);
					token = unknownAttributeTbl[name];

					if(!token) {
						token = new StringToken(name, Namespace.unknown);
						unknownAttributeTbl[name] = token;
					}

					tokenBuffer[++tokenNum] = token;

					let pos = tokenNum - elementStart;
					prefixBuffer[pos] = latestPrefix;
					namespaceBuffer[pos] = latestNamespace;
					unknownOffsetList[unknownCount++] = pos;
					break;

				case CodeType.VALUE_END_OFFSET:
				case CodeType.TEXT_END_OFFSET:

					tokenBuffer[++tokenNum] = this.getSlice(partStart, code);
					partStart = -1;
					break;

				case CodeType.UNKNOWN_PREFIX_END_OFFSET:
				case CodeType.UNKNOWN_XMLNS_END_OFFSET:
				case CodeType.UNKNOWN_URI_END_OFFSET:

					// Add the namespace prefix or URI to a separate trie.
					// Incoming code buffer should have been flushed immediately
					// after writing this token.

					if(kind == CodeType.UNKNOWN_URI_END_OFFSET) {
						let uri = this.getSlice(partStart, code);

						/* if(uri.id > dynamicTokenTblSize) {
							// TODO: report row and column in error messages.
							throw(new Error('Too many different xmlns URIs'));
						} */

						// Create a new namespace for the unrecognized URI.
						if(latestPrefix != config.xmlnsPrefixToken){
							name = latestPrefix!.name;
						} else name = '';
						const ns = new Namespace(name, uri, config.maxNamespace + 1);
						const idNamespace = config.bindNamespace(ns, latestPrefix!.name);

						this.resolve(elementStart, tokenNum, latestPrefix!, idNamespace);
						latestPrefix = null;
					} else {
						latestPrefix = config.addPrefix(this.getSlice(partStart, code));

						/* if(latestPrefix.id > dynamicTokenTblSize) {
							// TODO: report row and column in error messages.
							throw(new Error('Too many different xmlns prefixes'));
						} */

						this.native.setPrefix(latestPrefix.id);
					}

					partStart = -1;
					break;

				case CodeType.COMMENT_END_OFFSET:

					tokenBuffer[++tokenNum] = SpecialToken.comment;
					tokenBuffer[++tokenNum] = this.getSlice(partStart, code);
					partStart = -1;
					break;

				default:

					break;
			}
		}

		if(!pending && partStart >= 0) {
			this.storeSlice(partStart);
			partStart = 0;
		}

		config.updateNamespaces();

		this.partStart = partStart;
		this.partialLen = partialLen;
		this.latestElement = latestElement;
		this.latestPrefix = latestPrefix;
		this.latestNamespace = latestNamespace;

		this.tokenNum = tokenNum;
		this.elementStart = elementStart;
		this.unknownCount = unknownCount;
	}

	private storeSlice(start: number, end?: number) {
		if(!this.partList) this.partList = [];
		if(end !== 0) {
			this.partList.push(this.chunk.slice(start, end));
			this.partListTotalByteLen += (end || this.chunk.length) - start;
		}
	}

	/** getSlice helper for concatenating buffer parts. */
	private buildSlice(start: number, end?: number) {
		this.storeSlice(start, end);

		const result = decodeArray(concatArray(this.partList!, this.partListTotalByteLen));
		this.partList = null;
		this.partListTotalByteLen = 0;

		return(result);
	}

	/** Get a string from the input buffer. Prepend any parts left from
	  * previous code buffers. */
	private getSlice(start: number, end?: number) {
		return((
			this.partList ? this.buildSlice(start, end) :
			decodeArray(this.chunk, start, end)
		).replace(/\r\n?|\n\r/g, '\n'));
	}

	/** Resolve any prior occurrences of a recently defined prefix
	  * within the same element. */
	private resolve(elementStart: number, tokenNum: number, prefix: InternalToken, idNamespace: number) {
		const prefixBuffer = this.prefixBuffer;
		const tokenBuffer = this.tokenBuffer;
		const ns = this.config.namespaceList[idNamespace];
		const len = tokenNum - elementStart;
		let token: Token | number | string;

		if(!ns.base.defaultPrefix && prefix != this.config.xmlnsPrefixToken) {
			ns.base.defaultPrefix = prefix.name;
		}
		this.namespaceList[ns.base.id] = ns.base;
		this.namespacesChanged = true;

		for(let pos = 0; pos <= len; ++pos) {
			if(prefixBuffer[pos] == prefix) {
				token = tokenBuffer[pos + elementStart];
				if(token instanceof MemberToken) {
					tokenBuffer[pos + elementStart] = token.resolve(ns);
					this.namespaceBuffer[pos] = null;
				}
			}
		}
	}

	/** Current element not yet emitted (closing angle bracket unseen). */
	private latestElement: OpenToken;
	/** Previous namespace prefix token, applied to the next element, attribute
	  * or xmlns definition. */
	private latestPrefix: InternalToken | null;
	private latestNamespace: ParserNamespace | null;

	/** Current input buffer. */
	private chunk: ArrayType;

	private flush: (err: any, chunk: TokenBuffer | null) => void;

	private namespaceList: (Namespace | undefined)[] = [];
	private namespacesChanged = false;

	/** Storage for parts of strings split between chunks of input. */
	private partList: ArrayType[] | null = null;
	private partListTotalByteLen = 0;

	/** Offset to start of text in input buffer, or -1 if not reading text. */
	private partStart = -1;

	/** Number of valid initial bytes in next token. */
	private partialLen: number;

	/** Shared with C++ library. */
	private codeBuffer: Uint32Array;
	/** Buffer for stream output. */
	tokenBuffer: TokenBuffer = [];
	/** Current tokenBuffer offset for writing stream output. */
	private tokenNum = 1;

	/** Offset to start of current element definition in output buffer. */
	private elementStart = -1;
	/** Prefixes of latest tokenBuffer entries (their namespace may change
	  * if the prefix is remapped). Index 0 corresponds to elementStart. */
	private prefixBuffer: (InternalToken | null)[] = [];
	private namespaceBuffer: (ParserNamespace | null)[] = [];

	/** Unresolved elements (temporary tokens lacking a namespace). */
	private unknownElementTbl: { [ name: string ]: OpenToken } = {};
	/** Unresolved attributes (temporary tokens lacking a namespace). */
	private unknownAttributeTbl: { [ name: string ]: Token } = {};
	private unknownOffsetList: number[] = [];

	private unknownCount = 0;
}
