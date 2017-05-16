import * as stream from 'stream';

import { Token, TokenKind } from '../parser/Token';
import { TokenBuffer } from '../parser/Parser';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	AFTER_TEXT
}

export class Writer extends stream.Transform {
	constructor() {
		super({ objectMode: true });
	}

	transform(tokenBuffer: TokenBuffer, tokenNum: number, tokenCount: number, partList: string[], partNum: number) {
		let state = this.state;
		let indent = this.indent;
		let prefix = this.prefix;
		let token: Token | number | string;

		if(indent == '') tokenCount = 1;

		while(tokenNum < tokenCount) {

			token = tokenBuffer[++tokenNum];

			if(token instanceof Token) {
				switch(token.kind) {
					case TokenKind.open:

						partList[++partNum] = indent + '<' + token.name;
						indent += '\t';

						state = State.ELEMENT;
						break;

					case TokenKind.emitted:

						partList[++partNum] = '>';

						state = State.TEXT;
						break;

					case TokenKind.close:

						indent = indent.substr(0, indent.length - 1);

						if(state == State.ELEMENT) {
							partList[++partNum] = '/>';
						} else {
							if(state != State.AFTER_TEXT) partList[++partNum] = indent;
							partList[++partNum] = '</' + token.name + '>'
						}

						state = State.TEXT;
						break;

					case TokenKind.string:

						partList[++partNum] = ' ' + token.name + '=';
						break;
				}
			} else {
				if(state == State.TEXT) {
					partList[++partNum] = '' + token;
					state = State.AFTER_TEXT;
				} else {
					partList[++partNum] = '"' + token + '"';
				}
			}
		}

		this.state = state;
		this.indent = indent;
		this.prefix = prefix;

		return([ tokenNum, partNum ]);
	}

	_transform(tokenBuffer: TokenBuffer, enc: string, flush: (err: any, chunk: Buffer) => void) {
		let tokenNum = 0;
		let tokenCount = tokenBuffer[0] as number;
		let partList: string[] = [];
		let partNum = -1;

		if(!this.chunkCount) {
			[ tokenNum, partNum ] = this.transform(tokenBuffer, tokenNum, 1, partList, partNum);
			this.indent = '\n' + this.indent;
		}

		this.transform(tokenBuffer, tokenNum, tokenCount, partList, partNum);
		flush(null, new Buffer(partList.join('')));

		++this.chunkCount;
	}

	_flush( flush: (err: any, chunk: Buffer) => void) {
		flush(null, new Buffer('\n'));
	}

	private chunkCount = 0;
	private state = State.TEXT as State;
	private indent = '';
	private prefix = '';

}
