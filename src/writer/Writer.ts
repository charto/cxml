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
						indent += '\t';

						state = State.ELEMENT;
						break;

					case TokenKind.emitted:

						partList[++partNum] = '>';

						state = State.TEXT;
						break;

					case TokenKind.close:

						member = token as MemberToken;
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
			this.prefixList = [];
			for(let i = 0; i < chunk.prefixList.length; ++i) {
				this.prefixList[i] = chunk.prefixList[i] || '';
			}
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

	private chunkCount = 0;
	private state = State.TEXT as State;
	private indent = '';
	private nsElement: Namespace;
	private prefixList: string[];

}
