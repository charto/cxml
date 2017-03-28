import { ArrayType } from './Buffer';

declare class TextEncoder {
	constructor(encoding: string);

	encode(data: string): Uint8Array;
	decode(data: Uint8Array): string;
}

export class Token {
	constructor(public name: string, public id: number) {
		this.buf = (
			typeof(Buffer) == 'function' ?
			new Buffer(name) :
			new TextEncoder('utf-8').encode(name)
		);
	}

	buf: ArrayType;
}
