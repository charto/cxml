import * as stream from 'stream';

import { Namespace } from '../Namespace';
import { Token, TokenKind, MemberToken } from '../parser/Token';
import { TokenChunk } from '../parser/TokenChunk';
import { ParserConfig } from '../parser/ParserConfig';

import { Indent, State, indentPattern } from './Writer';

export class JsonWriter extends stream.Transform {

	/** @param config Parser config passed to any custom serializers.
	  * @param data Arbitrary data passed to any custom serializers. */

	constructor(private config?: ParserConfig, private data?: any) {
		super({ objectMode: true });
	}

	transform(chunk: TokenChunk) {
		let state = this.state;
		let depth = this.depth;
		let indent = this.indent;
		let nsElement = this.nsElement;
		const buffer = chunk.buffer;
		let token: typeof buffer[0];
		let member: MemberToken;
		let prefix: string;
		let serialized: any;

		let partList: string[] = [];
		let partNum = -1;
		let lastNum = chunk.length - 1;
		let tokenNum = -1;

		while(tokenNum < lastNum) {

			token = buffer[++tokenNum];

			if(token instanceof Token) {
				switch(token.kind) {
					case TokenKind.open:

						member = token as MemberToken;
						nsElement = member.ns;

						if(nsElement.isSpecial && nsElement.defaultPrefix == '?') {
							state = State.PROCESSING;
						} else {
							++depth;
							partList[++partNum] = indent + '[ "' + member.name + '"';
							state = State.ELEMENT;
						}

						indent = ',' + indentPattern.substr(0, depth);
						break;

					case TokenKind.emitted:

						state = State.TEXT;
						break;

					case TokenKind.close:

						if(state != State.PROCESSING) {
							member = token as MemberToken;
							indent = indentPattern.substr(0, --depth);

							if(state == State.TEXT) {
								partList[++partNum] = indent + ']';
							} else {
								partList[++partNum] = ' ]';
							}

							indent = ',' + indent;
						}

						state = State.TEXT;
						break;

					case TokenKind.string:

						member = token as MemberToken;

						partList[++partNum] = ', [ "$' + member.name + '"';
						break;

					case TokenKind.comment:

						state = State.COMMENT;
						break;

					case TokenKind.other:

						if(token.serializeJson) {
							serialized = token.serializeJson(indent, this.config, this.data);
							if(typeof(serialized) != 'string') serialized = JSON.stringify(serialized);

							partList[++partNum] = indent + serialized;
							state = State.AFTER_TEXT;
						}
						break;
				}
			} else {
				switch(state) {
					case State.TEXT:

						partList[++partNum] = ', [ "$", ' + JSON.stringify(token) + ' ]';
						state = State.AFTER_TEXT;
						break;

					case State.ELEMENT:
					case State.PROCESSING:

						partList[++partNum] = ', ' + JSON.stringify(token) + ' ]';
						break;

					case State.COMMENT:

						break;

				}
			}
		}

		this.state = state;
		this.depth = depth;
		this.indent = indent;
		this.nsElement = nsElement;

		return(partList);
	}

	_transform(chunk: TokenChunk | null, enc: string, flush: (err: any, chunk: string) => void) {
		if(!chunk) {
			flush(null, '');
			return;
		}

		const partList = this.transform(chunk);
		flush(null, partList.join(''));
	}

	_flush( flush: (err: any, chunk: string) => void) {
		flush(null, '\n');
	}

	private state = State.TEXT as State;
	private depth = Indent.MIN_DEPTH;
	private indent = '';
	private nsElement: Namespace;

}
