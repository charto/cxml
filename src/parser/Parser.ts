import { ArrayType, encodeArray } from '../Buffer';
import { Namespace } from '../Namespace';
import { CodeType } from '../tokenizer/CodeType';
import { ErrorType } from '../tokenizer/ErrorType';
import { NativeParser } from './ParserLib';
import { ParserConfig } from './ParserConfig';
import { ParserNamespace } from './ParserNamespace';
import { InternalToken } from './InternalToken';
import { TokenSet } from '../tokenizer/TokenSet';
import { TokenChunk } from './TokenChunk';
import { Stitcher } from './Stitcher';
import {
	Token,
	TokenBuffer,
	TokenKind,
	SpecialToken,
	MemberToken,
	OpenToken,
	CloseToken,
	StringToken,
	SgmlToken
} from './Token';

// const codeBufferSize = 2;
// const codeBufferSize = 3;
const codeBufferSize = 8192;

const chunkSize = Infinity;

const enum TOKEN {
	SHIFT = 5,
	MASK = 31
}

export class ParseError extends Error {

	constructor(public code: ErrorType, public row: number, public col: number) {
		super('Parse error on line ' + row + ' column ' + col);
	}

}

/** XML parser stream, emits tokens with fully qualified names. */

export class Parser {

	/** Call only from ParserConfig.createParser.
	  * @param config Reference to C++ config object.
	  * @param native Reference to C++ parser object. */

	constructor(private config: ParserConfig, private native: NativeParser) {
		this.codeBuffer = new Uint32Array(codeBufferSize);
		this.native.setCodeBuffer(this.codeBuffer, () => this.parseCodeBuffer(true));

		for(let ns of this.config.namespaceList) {
			if(ns && (ns.base.isSpecial || ns.base.defaultPrefix == 'xml')) {
				this.namespaceList[ns.base.id] = ns.base;
			}
		}
	}

	public getConfig() { return(this.config); }

	bindPrefix(prefix: InternalToken, uri: InternalToken) {
		this.native.bindPrefix(prefix.id, uri.id);
	}

	destroy() {
		this.native.destroy();
	}

	public parseSync(data: string | ArrayType) {
		const buffer: TokenBuffer = [];
		let namespaceList: (Namespace | undefined)[] | undefined;

		this.write(data, '', (err: any, chunk: TokenChunk | null) => {
			if(err || !chunk) throw(err);

			for(let tokenNum = 0; tokenNum < chunk.length; ++tokenNum) {
				buffer.push(chunk.buffer[tokenNum]);
			}

			if(chunk.namespaceList) namespaceList = chunk.namespaceList;

			chunk.free();
		});

		const output = TokenChunk.allocate(buffer);
		output.namespaceList = namespaceList;

		return(output);
	}

	write(
		chunk: string | ArrayType,
		enc: string,
		flush: (err: any, chunk: TokenChunk | null) => void
	) {
		if(this.hasError) {
			flush(this.hasError, null);
			return;
		}

		if(typeof(chunk) == 'string') chunk = encodeArray(chunk);

		const len = chunk.length;
		let nativeStatus = ErrorType.OK;
		let next: number;

		if(len < chunkSize) {
			this.chunk = chunk;
			this.stitcher.setChunk(this.chunk);
			nativeStatus = this.native.parse(this.chunk);
			this.parseCodeBuffer(false);
		} else {
			// Limit size of buffers sent to native code.
			for(let pos = 0; pos < len; pos = next) {
				next = Math.min(pos + chunkSize, len);

				this.chunk = chunk.slice(pos, next);
				this.stitcher.setChunk(this.chunk);
				nativeStatus = this.native.parse(this.chunk);

				if(nativeStatus != ErrorType.OK) break;
				this.parseCodeBuffer(false);
			}
		}

		if(nativeStatus != ErrorType.OK) {
			this.hasError = new ParseError(nativeStatus, this.native.row + 1, this.native.col + 1);
			flush(this.hasError, null);
			return;
		}

		if(this.elementStart < 0) {
			if(this.namespacesChanged) this.tokenChunk.namespaceList = this.namespaceList;
			flush(null, this.tokenChunk);

			this.tokenChunk = TokenChunk.allocate();
		} else {
			// Not ready to flush but have to send something to get more input.
			flush(null, null);
		}
	}

	private parseCodeBuffer(pending: boolean) {
		const config = this.config;
		const stitcher = this.stitcher;
		const codeBuffer = this.codeBuffer;
		const codeCount = codeBuffer[0];

		// NOTE: These must be updated if config is unlinked!
		let elementList = config.elementSpace.list;
		let attributeList = config.attributeSpace.list;
		let prefixList = config.prefixSpace.list;
		let uriList = config.uriSpace.list;
		let partialList = elementList;

		let codeNum = 0;
		let partStart = this.partStart;
		let partialLen = this.partialLen;
		let latestElement = this.latestElement;
		let latestPrefix = this.latestPrefix;
		let latestNamespace = this.latestNamespace;

		const tokenBuffer = this.tokenChunk.buffer;
		const prefixBuffer = this.prefixBuffer;
		const namespaceBuffer = this.namespaceBuffer;
		const unknownElementTbl = this.unknownElementTbl;
		const unknownAttributeTbl = this.unknownAttributeTbl;
		const sgmlTbl = this.sgmlTbl;
		const unknownOffsetList = this.unknownOffsetList;
		let tokenNum = this.tokenChunk.length - 1;
		let token: Token;
		let name: string;
		let prefix: string;
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
								// Ensure namespace is updated after config unlink.
								ns = config.namespaceList[ns.id];
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
					// If latestprefix is null, set attribute prefix to match its parent element.
					prefixBuffer[tokenNum - elementStart] = latestPrefix || prefixBuffer[0];
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
					tokenBuffer[++tokenNum] = latestPrefix!.prefix;
					tokenBuffer[++tokenNum] = this.config.namespaceList[code].uriToken;
					latestPrefix = null;
					break;

				case CodeType.SGML_ID:

					token = elementList[code].open;
					prefix = (token as MemberToken).ns.defaultPrefix;
					name = (token as MemberToken).name;
					token = sgmlTbl[prefix + ':' + name];

					if(!token) {
						token = new SgmlToken(name, prefix);
						sgmlTbl[prefix + ':' + name] = token as SgmlToken;
					}

					tokenBuffer[++tokenNum] = token;
					break;

				case CodeType.TEXT_START_OFFSET:
				case CodeType.CDATA_START_OFFSET:
				case CodeType.VALUE_START_OFFSET:
				case CodeType.COMMENT_START_OFFSET:
				case CodeType.SGML_TEXT_START_OFFSET:
				case CodeType.UNKNOWN_START_OFFSET:

					partStart = code;
					break;

				case CodeType.UNKNOWN_OPEN_ELEMENT_END_OFFSET:

					name = stitcher.getSlice(partStart, code);
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

					partStart = -1;
					break;

				case CodeType.UNKNOWN_CLOSE_ELEMENT_END_OFFSET:

					name = stitcher.getSlice(partStart, code);
					tokenBuffer[++tokenNum] = (latestNamespace ?
						latestNamespace.addElement(name) :
						unknownElementTbl[name]
					).close;

					partStart = -1;
					break;

				case CodeType.UNKNOWN_ATTRIBUTE_END_OFFSET:

					name = stitcher.getSlice(partStart, code);
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

					partStart = -1;
					break;

				case CodeType.UNKNOWN_SGML_END_OFFSET:

					prefix = latestPrefix ? latestPrefix.name : '';
					name = stitcher.getSlice(partStart, code);
					token = sgmlTbl[prefix + ':' + name];

					if(!token) {
						token = new SgmlToken(name, prefix);
						sgmlTbl[prefix + ':' + name] = token as SgmlToken;
					}

					tokenBuffer[++tokenNum] = token;

					partStart = -1;
					break;

				case CodeType.SGML_EMITTED:
				case CodeType.SGML_NESTED_START:
				case CodeType.SGML_NESTED_END:

					tokenBuffer[++tokenNum] = this.specialTokenTbl[kind];
					break;

				case CodeType.COMMENT_END_OFFSET:
				case CodeType.SGML_TEXT_END_OFFSET:

					tokenBuffer[++tokenNum] = this.specialTokenTbl[kind];

				// Fallthru
				case CodeType.VALUE_END_OFFSET:
				case CodeType.TEXT_END_OFFSET:

					tokenBuffer[++tokenNum] = stitcher.getSlice(partStart, code);
					partStart = -1;
					break;

				case CodeType.CDATA_END_OFFSET:

					tokenBuffer[++tokenNum] = SpecialToken.cdata;
					name = stitcher.getSlice(partStart, code);
					tokenBuffer[++tokenNum] = name.substr(0, name.length - 3);
					partStart = -1;
					break;

				case CodeType.UNKNOWN_PREFIX_END_OFFSET:
				case CodeType.UNKNOWN_XMLNS_END_OFFSET:
				case CodeType.UNKNOWN_URI_END_OFFSET:

					// Add the namespace prefix or URI to a separate trie.
					// Incoming code buffer should have been flushed immediately
					// after writing this token.

					if(kind == CodeType.UNKNOWN_URI_END_OFFSET) {
						let uri = stitcher.getSlice(partStart, code);

						/* if(uri.id > dynamicTokenTblSize) {
							// TODO: report row and column in error messages.
							throw(new Error('Too many different xmlns URIs'));
						} */

						// Create a new namespace for the unrecognized URI.
						name = latestPrefix!.name;
						const ns = new Namespace(name, uri, config.maxNamespace + 1);
						// This may unlink the config:
						const idNamespace = config.bindNamespace(ns, latestPrefix!.name, this);
						this.resolve(elementStart, tokenNum, latestPrefix!, idNamespace);
						tokenBuffer[++tokenNum] = latestPrefix!.prefix;
						tokenBuffer[++tokenNum] = this.config.namespaceList[idNamespace].uriToken;
						latestPrefix = null;
					} else {
						// This may unlink the config:
						latestPrefix = config.addPrefix(stitcher.getSlice(partStart, code));

						/* if(latestPrefix.id > dynamicTokenTblSize) {
							// TODO: report row and column in error messages.
							throw(new Error('Too many different xmlns prefixes'));
						} */

						this.native.setPrefix(latestPrefix.id);
					}

					// Config may have been unlinked so update references to it.
					elementList = config.elementSpace.list;
					attributeList = config.attributeSpace.list;
					prefixList = config.prefixSpace.list;
					uriList = config.uriSpace.list;

					partStart = -1;
					break;

				case CodeType.PARTIAL_LEN:

					partialLen = code;
					break;

				case CodeType.PARTIAL_URI_ID:

					partialList = uriList;

				// Fallthru
				case CodeType.PARTIAL_PREFIX_ID:

					if(partialList == elementList) partialList = prefixList;

				// Fallthru
				case CodeType.PARTIAL_ATTRIBUTE_ID:

					if(partialList == elementList) partialList = attributeList;

				// Fallthru
				case CodeType.PARTIAL_ELEMENT_ID:

					stitcher.reset(partialList[code].buf, partialLen);
					partialList = elementList;
					break;

				default:

					break;
			}
		}

		if(!pending && partStart >= 0) {
			stitcher.storeSlice(partStart);
			partStart = 0;
		}

		// NOTE: Any active cursor in native code will still use the old trie
		// after update.
		config.updateNamespaces();

		this.partStart = partStart;
		this.partialLen = partialLen;
		this.latestElement = latestElement;
		this.latestPrefix = latestPrefix;
		this.latestNamespace = latestNamespace;

		this.tokenChunk.length = tokenNum + 1;
		this.elementStart = elementStart;
		this.unknownCount = unknownCount;
	}

	/** Resolve any prior occurrences of a recently defined prefix
	  * within the same element. */
	private resolve(elementStart: number, tokenNum: number, prefix: InternalToken, idNamespace: number) {
		const prefixBuffer = this.prefixBuffer;
		const tokenBuffer = this.tokenChunk.buffer;
		const ns = this.config.namespaceList[idNamespace];
		const len = tokenNum - elementStart;
		let token: Token | number | string;

		if(!ns.base.defaultPrefix) {
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

	private stitcher = new Stitcher();

	/** Current element not yet emitted (closing angle bracket unseen). */
	private latestElement: OpenToken;
	/** Previous namespace prefix token, applied to the next element, attribute
	  * or xmlns definition. */
	private latestPrefix: InternalToken | null;
	private latestNamespace: ParserNamespace | null;

	/** Current input buffer. */
	private chunk: ArrayType;

	private namespaceList: (Namespace | undefined)[] = [];
	private namespacesChanged = true;

	/** Offset to start of text in input buffer, or -1 if not reading text. */
	private partStart = -1;

	/** Number of valid initial bytes in next token. */
	private partialLen: number;

	/** Shared with C++ library. */
	private codeBuffer: Uint32Array;
	/** Stream output buffer chunk. */
	tokenChunk = TokenChunk.allocate();

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
	private sgmlTbl: { [ name: string ]: SgmlToken } = {};
	private unknownOffsetList: number[] = [];

	private unknownCount = 0;

	specialTokenTbl = {
		[CodeType.COMMENT_END_OFFSET]: SpecialToken.comment,
		[CodeType.SGML_EMITTED]: SpecialToken.sgmlEmitted,
		[CodeType.SGML_NESTED_START]: SpecialToken.sgmlNestedStart,
		[CodeType.SGML_NESTED_END]: SpecialToken.sgmlNestedEnd,
		[CodeType.SGML_TEXT_END_OFFSET]: SpecialToken.sgmlText
	};

	private hasError?: ParseError;

}
