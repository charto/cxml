import * as stream from 'stream';

import { Token } from '../tokenizer/Token';
import { TokenType, TokenBuffer } from '../parser/Parser';

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

		if(indent == '') tokenCount = 1;

		while(tokenNum < tokenCount) {

			switch(tokenBuffer[++tokenNum] as TokenType) {

				case TokenType.PREFIX:

					prefix = (tokenBuffer[++tokenNum] as Token).name + ':';
					break;

				case TokenType.OPEN_ELEMENT:

					partList[++partNum] = indent + '<' + prefix + (tokenBuffer[++tokenNum] as Token).name;
					indent += '\t';
					prefix = '';

					state = State.ELEMENT;
					break;

				case TokenType.UNKNOWN_OPEN_ELEMENT:

					partList[++partNum] = indent + '<' + prefix + tokenBuffer[++tokenNum];
					indent += '\t';
					prefix = '';

					state = State.ELEMENT;
					break;

				case TokenType.CLOSE_ELEMENT:

					indent = indent.substr(0, indent.length - 1);

					if(state != State.AFTER_TEXT) partList[++partNum] = indent;
					partList[++partNum] = '</' + prefix + (tokenBuffer[++tokenNum] as Token).name + '>'
					prefix = '';

					state = State.TEXT;
					break;

				case TokenType.UNKNOWN_CLOSE_ELEMENT:

					indent = indent.substr(0, indent.length - 1);

					if(state != State.AFTER_TEXT) partList[++partNum] = indent;
					partList[++partNum] = '</' + prefix + tokenBuffer[++tokenNum] + '>'
					prefix = '';

					state = State.TEXT;
					break;

				case TokenType.CLOSED_ELEMENT_EMITTED:

					indent = indent.substr(0, indent.length - 1);
					partList[++partNum] = '/>';

					state = State.TEXT;
					break;

				case TokenType.ELEMENT_EMITTED:

					partList[++partNum] = '>';

					state = State.TEXT;
					break;

				case TokenType.ATTRIBUTE:

					partList[++partNum] = ' ' + prefix + (tokenBuffer[++tokenNum] as Token).name + '=';
					prefix = '';
					break;

				case TokenType.UNKNOWN_ATTRIBUTE:

					partList[++partNum] = ' ' + prefix + tokenBuffer[++tokenNum] + '=';
					prefix = '';
					break;

				case TokenType.VALUE:

					partList[++partNum] = '"' + tokenBuffer[++tokenNum] + '"';
					break;

				case TokenType.TEXT:

					partList[++partNum] = tokenBuffer[++tokenNum] as string;

					state = State.AFTER_TEXT;
					break;

				case TokenType.PROCESSING:

					partList[++partNum] = indent + '<?' + (tokenBuffer[++tokenNum] as Token).name;

					state = State.PROCESSING;
					break;

				case TokenType.XMLNS:

					partList[++partNum] = ' xmlns:' + (tokenBuffer[++tokenNum] as Token).name + '=';
					break;

				case TokenType.URI:

					partList[++partNum] = '"' + (tokenBuffer[++tokenNum] as Token).name + '"';
					break;

				case TokenType.UNKNOWN_PROCESSING:

					partList[++partNum] = indent + '<?' + tokenBuffer[++tokenNum];

					state = State.PROCESSING;
					break;

				case TokenType.XML_PROCESSING_END:

					partList[++partNum] = '?>';
					break;

				case TokenType.SGML_PROCESSING_END:

					partList[++partNum] = '>';
					break;

				case TokenType.COMMENT:

					partList[++partNum] = indent + '<!--' + tokenBuffer[++tokenNum];
					break;

				default:

					break;

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
