import { ArrayType } from './Buffer';

declare class TextEncoder {
	constructor(encoding: string);

	encode(data: string): Uint8Array;
	decode(data: Uint8Array): string;
}

export class Token {
	constructor(name: string) {
		this.name = name;
		this.buf = (
			typeof(Buffer) == 'function' ?
			new Buffer(name) :
			new TextEncoder('utf-8').encode(name)
		);

		this.id = Token.idNext++;
		Token.list[this.id] = this;
	}

	static idNext = 0;
	static list: Token[] = [];

	name: string;
	buf: ArrayType;
	id?: number;
}
