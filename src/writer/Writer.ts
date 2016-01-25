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

	_transform(tokenBuffer: TokenBuffer, enc: string, flush: (err: any, chunk: Buffer) => void) {
		let tokenNum = 0;
		let tokenCount = tokenBuffer[0];
		let token: Token;

		let partList: string[] = [];
		let partNum = -1;

		let state = this.state;
		let indent = this.indent;

		while(tokenNum < tokenCount) {

			switch(tokenBuffer[++tokenNum] as TokenType) {

				case TokenType.OPEN_ELEMENT:

					if(state == State.ELEMENT) partList[++partNum] = '>\n';

					partList[++partNum] = indent + '<' + (tokenBuffer[++tokenNum] as Token).name;
					indent += '\t';

					state = State.ELEMENT;
					break;

				case TokenType.UNKNOWN_OPEN_ELEMENT:

					if(state == State.ELEMENT) partList[++partNum] = '>\n';

					partList[++partNum] = indent + '<' + tokenBuffer[++tokenNum];
					indent += '\t';

					state = State.ELEMENT;
					break;

				case TokenType.CLOSE_ELEMENT:

					indent = indent.substr(1);

					if(state == State.ELEMENT) {
						partList[++partNum] = '/>\n';
						++tokenNum;
					} else {
						if(state != State.AFTER_TEXT) partList[++partNum] = indent;
						partList[++partNum] = '</' + (tokenBuffer[++tokenNum] as Token).name + '>\n'
					}

					state = State.TEXT;
					break;

				case TokenType.UNKNOWN_CLOSE_ELEMENT:

					indent = indent.substr(1);

					if(state == State.ELEMENT) {
						partList[++partNum] = '/>\n';
						++tokenNum;
					} else {
						if(state != State.AFTER_TEXT) partList[++partNum] = indent;
						partList[++partNum] = '</' + tokenBuffer[++tokenNum] + '>\n'
					}

					state = State.TEXT;
					break;

				case TokenType.ATTRIBUTE:

					partList[++partNum] = ' ' + (tokenBuffer[++tokenNum] as Token).name + '=';
					break;

				case TokenType.UNKNOWN_ATTRIBUTE:

					partList[++partNum] = ' ' + tokenBuffer[++tokenNum] + '=';
					break;

				case TokenType.VALUE:

					partList[++partNum] = '"' + tokenBuffer[++tokenNum] + '"';
					break;

				case TokenType.TEXT:

					if(state == State.ELEMENT) partList[++partNum] = '>';
					partList[++partNum] = tokenBuffer[++tokenNum] as string;

					state = State.AFTER_TEXT;
					break;

				case TokenType.PROCESSING:

					if(state == State.ELEMENT) partList[++partNum] = '>\n';
					partList[++partNum] = '<?' + (tokenBuffer[++tokenNum] as Token).name;

					state = State.PROCESSING;
					break;

				case TokenType.UNKNOWN_PROCESSING:

					if(state == State.ELEMENT) partList[++partNum] = '>\n';
					partList[++partNum] = '<?' + tokenBuffer[++tokenNum];

					state = State.PROCESSING;
					break;

				case TokenType.XML_PROCESSING_END:

					partList[++partNum] = '?>\n';
					break;

				case TokenType.SGML_PROCESSING_END:

					partList[++partNum] = '>\n';
					break;

				case TokenType.COMMENT:

					partList[++partNum] = indent + '<!--' + tokenBuffer[++tokenNum] + '>\n';
					break;

				default:

					break;

			}
		}

		flush(null, new Buffer(partList.join('')));

		this.state = state;
		this.indent = indent;
	}

	private state = State.TEXT as State;
	private indent = '';

}
