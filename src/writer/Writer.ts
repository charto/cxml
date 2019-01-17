import * as stream from 'stream';

import { Namespace } from '../Namespace';
import { TokenChunk } from '../parser/TokenChunk';
import { Token, TokenBuffer, TokenKind, MemberToken } from '../parser/Token';

export const enum Indent {
	MIN_DEPTH = 1,
	MAX_DEPTH = 256
}

export const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	AFTER_TEXT,
	COMMENT,
	CDATA
}

export const indentPattern = '\n' + new Array(Indent.MAX_DEPTH).join('\t');

export class Writer extends stream.Transform {

	/** @param data Arbitrary data passed to any custom serializers. */

	constructor(private data?: any) {
		super({ objectMode: true });
	}

	transform(chunk: TokenChunk | TokenBuffer | string, partList: string[]) {
		const prefixList = this.prefixList;
		const chunkCount = this.chunkCount++;
		let buffer: TokenBuffer;
		let state = this.state;
		let depth = this.depth;
		let indent = this.indent;
		let nsElement = this.nsElement;
		let token: typeof buffer[0];
		let member: MemberToken;
		let prefix: string;
		let serialized: string | TokenBuffer;

		let partNum = partList.length - 1;
		let lastNum = chunk.length - 1;
		let tokenNum = -1;
		let namespaceList: (Namespace | undefined)[] | undefined;

		if(typeof(chunk) == 'string') {
			partList.push(chunk);
			return(partList);
		} else if(chunk instanceof TokenChunk) {
			buffer = chunk.buffer;
			namespaceList = chunk.namespaceList;
		} else {
			buffer = chunk;
		}

		if(!chunkCount) {
			if(!namespaceList) {
				namespaceList = [];

				while(tokenNum < lastNum) {
					token = buffer[++tokenNum];

					if(token instanceof MemberToken) {
						namespaceList[token.ns.id] = token.ns;
					}
				}

				tokenNum = -1;
			}

			this.copyPrefixes(namespaceList);
		}

		while(tokenNum < lastNum) {

			token = buffer[++tokenNum];

			if(token instanceof Token) {
				switch(token.kind) {
					case TokenKind.open:

						member = token as MemberToken;
						nsElement = member.ns;
						partList[++partNum] = indent + '<' + prefixList[nsElement.id] + member.name;

						if(nsElement.isSpecial && nsElement.defaultPrefix == '?') {
							state = State.PROCESSING;
						} else {
							if(depth++ == Indent.MIN_DEPTH) partList[++partNum] = this.xmlnsDefinitions;
							state = State.ELEMENT;
						}

						indent = indentPattern.substr(0, depth);
						break;

					case TokenKind.emitted:

						partList[++partNum] = '>';

						state = State.TEXT;
						break;

					case TokenKind.close:

						if(state == State.PROCESSING) {
							partList[++partNum] = '?>';
						} else {
							member = token as MemberToken;
							indent = indentPattern.substr(0, --depth);

							if(state == State.ELEMENT) {
								partList[++partNum] = '/>';
							} else {
								if(state != State.AFTER_TEXT) partList[++partNum] = indent;
								partList[++partNum] = '</' + prefixList[member.ns.id] + member.name + '>'
							}
						}

						state = State.TEXT;
						break;

					case TokenKind.string:

						member = token as MemberToken;
						// Omit prefixes for attributes in the same namespace
						// as their parent element.
						if(member.ns == nsElement) prefix = '';
						else prefix = prefixList[member.ns.id];

						partList[++partNum] = ' ' + prefix + member.name + '=';
						break;

					case TokenKind.comment:

						state = State.COMMENT;
						break;

					case TokenKind.cdata:

						state = State.CDATA;
						break;

					case TokenKind.other:

						if(token.serialize) {

							serialized = token.serialize(indent, this.data);
							if(typeof(serialized) == 'string') {
								partList[++partNum] = serialized;
								state = State.AFTER_TEXT;
							} else {
								this.state = state;
								this.depth = depth;
								this.indent = indent;

								this.transform(TokenChunk.allocate(serialized), partList);
								partNum = partList.length - 1;
							}
						}
						break;
				}
			} else {
				switch(state) {
					case State.TEXT:
					case State.AFTER_TEXT:

						partList[++partNum] = '' + token;
						state = State.AFTER_TEXT;
						break;

					case State.CDATA:

						partList[++partNum] = '<![CDATA[' + token + ']]>';
						state = State.AFTER_TEXT;
						break;

					case State.ELEMENT:
					case State.PROCESSING:

						partList[++partNum] = '"' + token + '"';
						break;

					case State.COMMENT:

						partList[++partNum] = indent + '<!--' + token;
						break;

				}
			}
		}

		this.state = state;
		this.depth = depth;
		this.indent = indent;
		this.nsElement = nsElement;

		if(chunk instanceof TokenChunk) chunk.free();

		return(partList);
	}

	_transform(chunk: TokenChunk | TokenBuffer | null, enc: string, flush: (err: any, chunk: string) => void) {
		if(!chunk) {
			flush(null, '');
			return;
		}

		const partList: string[] = [];

		if(!this.chunkCount) {
			const token = chunk instanceof TokenChunk ? chunk.buffer[0] : chunk[0];

			if(
				!(token instanceof Token) ||
				token.kind != TokenKind.open ||
				(token as MemberToken).ns != Namespace.processing ||
				(token as MemberToken).name != 'xml'
			) {
				partList.push('<?xml version="1.0" encoding="utf-8"?>\n');
			}
		}

		this.transform(chunk, partList);
		flush(null, partList.join(''));
	}

	_flush( flush: (err: any, chunk: string) => void) {
		flush(null, '\n');
	}

	copyPrefixes(namespaceList: (Namespace | undefined)[]) {
		const prefixTbl = this.prefixTbl;
		const prefixList = this.prefixList;
		let prefix: string | undefined;
		let ns: Namespace | undefined;

		// Add a number to distinguish between duplicate prefix names.

		for(let i = 0; i < namespaceList.length; ++i) {
			ns = namespaceList[i];
			if(!ns) continue;

			prefix = ns.defaultPrefix;
			if(!prefix && !ns.isSpecial) continue;

			if(prefixTbl[prefix]) {
				let j = 1;

				do {
					prefix = ns!.defaultPrefix + (++j);
				} while(prefixTbl[prefix]);
			}

			prefixList[i] = prefix;
			prefixTbl[prefix] = i + 1;
		}

		let j = 0;

		// Name all unnamed prefixes with "p" and a sequence number.

		for(let i = 0; i < namespaceList.length; ++i) {
			ns = namespaceList[i];
			if(!ns) continue;

			prefix = ns.defaultPrefix;
			if(prefix || ns.isSpecial) continue;

			do {
				prefix = 'p' + (++j);
			} while(prefixTbl[prefix]);

			prefixList[i] = prefix;
			prefixTbl[prefix] = i + 1;
		}

		let definitionList: string[] = [];

		for(let i = 0; i < namespaceList.length; ++i) {
			ns = namespaceList[i];
			prefix = prefixList[i];
			if(!prefix || !ns || ns.isSpecial) continue;

			if(prefix != 'xml') definitionList.push(' xmlns:' + prefix + '="' + ns.uri + '"');
			this.prefixList[i] = prefix + ':';
		}

		this.xmlnsDefinitions = definitionList.join('');
	}

	private chunkCount = 0;
	private state = State.TEXT as State;
	private depth = Indent.MIN_DEPTH;
	private indent = '';
	private nsElement: Namespace;
	private prefixList: string[] = [];
	private prefixTbl: { [ key: string ]: number } = {};
	private xmlnsDefinitions = '';

}
