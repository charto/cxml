import * as stream from 'stream';

import { Namespace } from '../Namespace';
import { Token, TokenKind, MemberToken } from '../parser/Token';
import { TokenChunk } from '../parser/Parser';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	AFTER_TEXT,
	COMMENT
}

export class Writer extends stream.Transform {
	constructor() {
		super({ objectMode: true });
	}

	transform(chunk: TokenChunk, tokenNum: number, partList: string[], partNum: number) {
		const prefixList = this.prefixList;
		let buffer = chunk.buffer;
		let state = this.state;
		let depth = this.depth;
		let indent = this.indent;
		let nsElement = this.nsElement;
		let token: Token | number | string;
		let member: MemberToken;
		let prefix: string;

		const lastNum = (indent == '') ? 1 : chunk.last;

		while(tokenNum < lastNum) {

			token = buffer[++tokenNum];

			if(token instanceof Token) {
				switch(token.kind) {
					case TokenKind.open:

						member = token as MemberToken;
						nsElement = member.ns;
						partList[++partNum] = indent + '<' + prefixList[nsElement.id] + member.name;
						if(depth == 0) partList[++partNum] = this.xmlnsDefinitions;
						++depth;
						indent += '\t';

						state = State.ELEMENT;
						break;

					case TokenKind.emitted:

						partList[++partNum] = '>';

						state = State.TEXT;
						break;

					case TokenKind.close:

						member = token as MemberToken;
						--depth;
						indent = indent.substr(0, indent.length - 1);

						if(state == State.ELEMENT) {
							partList[++partNum] = '/>';
						} else {
							if(state != State.AFTER_TEXT) partList[++partNum] = indent;
							partList[++partNum] = '</' + prefixList[member.ns.id] + member.name + '>'
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
				}
			} else {
				switch(state) {
					case State.TEXT:

						partList[++partNum] = '' + token;
						state = State.AFTER_TEXT;
						break;

					case State.ELEMENT:

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

		return([ tokenNum, partNum ]);
	}

	_transform(chunk: TokenChunk | null, enc: string, flush: (err: any, chunk: Buffer) => void) {
		if(!chunk) {
			flush(null, new Buffer(''));
			return;
		}

		let tokenNum = -1;
		let partList: string[] = [];
		let partNum = -1;

		if(!this.chunkCount) {
			this.copyPrefixes(chunk.namespaceList, chunk.prefixList);

			[ tokenNum, partNum ] = this.transform(chunk, tokenNum, partList, partNum);
			this.indent = '\n' + this.indent;
		}

		this.transform(chunk, tokenNum, partList, partNum);
		flush(null, new Buffer(partList.join('')));

		++this.chunkCount;
	}

	_flush( flush: (err: any, chunk: Buffer) => void) {
		flush(null, new Buffer('\n'));
	}

	copyPrefixes(namespaceList: Namespace[], prefixList: string[]) {
		const prefixTbl = this.prefixTbl;
		let prefix: string;

		for(let i = 0; i < prefixList.length; ++i) {
			prefix = prefixList[i];
			if(!prefix) continue;

			if(prefixTbl[prefix]) {
				let j = 1;

				do {
					prefix = prefixList[i] + (++j);
				} while(prefixTbl[prefix]);
			}

			this.prefixList[i] = prefix;
			prefixTbl[prefix] = i + 1;
		}

		let j = 0;

		for(let i = 0; i < prefixList.length; ++i) {
			prefix = prefixList[i];
			if(prefix) continue;

			do {
				prefix = 'p' + (++j);
			} while(prefixTbl[prefix]);

			this.prefixList[i] = prefix;
			prefixTbl[prefix] = i + 1;
		}

		this.xmlnsDefinitions = this.prefixList.map(
			(prefix: string, num: number) => namespaceList[num] ?
			' xmlns:' + prefix + '="' + namespaceList[num].uri + '"' :
			''
		).join('');

		for(let i = 0; i < prefixList.length; ++i) {
			this.prefixList[i] = this.prefixList[i] + ':';
		}
	}

	private chunkCount = 0;
	private state = State.TEXT as State;
	private depth = 0;
	private indent = '';
	private nsElement: Namespace;
	private prefixList: string[] = [];
	private prefixTbl: { [ key: string ]: number } = {};
	private xmlnsDefinitions = '';

}
