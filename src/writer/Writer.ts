import * as stream from 'stream';

import { Namespace } from '../Namespace';
import { Token, TokenKind } from '../parser/Token';
import { TokenChunk } from '../parser/Parser';

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

	transform(chunk: TokenChunk, tokenNum: number, tokenCount: number, partList: string[], partNum: number) {
		const prefixList = this.prefixList;
		let buffer = chunk.buffer;
		let state = this.state;
		let indent = this.indent;
		let nsElement = this.nsElement;
		let token: Token | number | string;
		let prefix: string;

		if(indent == '') tokenCount = 1;

		while(tokenNum < tokenCount) {

			token = buffer[++tokenNum];

			if(token instanceof Token) {
				switch(token.kind) {
					case TokenKind.open:

						nsElement = token.ns;
						partList[++partNum] = indent + '<' + prefixList[token.ns!.id] + token.name;
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
							partList[++partNum] = '</' + prefixList[token.ns!.id] + token.name + '>'
						}

						state = State.TEXT;
						break;

					case TokenKind.string:

						// Omit prefixes for attributes in the same namespace
						// as their parent element.
						if(token.ns == nsElement) prefix = '';
						else prefix = token.ns!.uri + ':';

						partList[++partNum] = ' ' + prefix + token.name + '=';
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
		this.nsElement = nsElement;

		return([ tokenNum, partNum ]);
	}

	_transform(chunk: TokenChunk, enc: string, flush: (err: any, chunk: Buffer) => void) {
		let tokenNum = -1;
		let partList: string[] = [];
		let partNum = -1;

		if(!this.chunkCount) {
			this.prefixList = [];
			for(let i = 0; i < chunk.prefixList.length; ++i) {
				this.prefixList[i] = chunk.prefixList[i] || '';
			}
			[ tokenNum, partNum ] = this.transform(chunk, tokenNum, 1, partList, partNum);
			this.indent = '\n' + this.indent;
		}

		this.transform(chunk, tokenNum, chunk.length, partList, partNum);
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
