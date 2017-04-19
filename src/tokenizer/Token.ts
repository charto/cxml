import { Namespace } from '../Namespace';
import { ArrayType } from './Buffer';

declare class TextEncoder {
	constructor(encoding: string);

	encode(data: string): Uint8Array;
	decode(data: Uint8Array): string;
}

export class Token {
	constructor(public name: string, public ns?: Namespace) {
		if(name == 'xmlns') Token.xmlns = this;

		this.buf = (
			typeof(Buffer) == 'function' ?
			new Buffer(name) :
			new TextEncoder('utf-8').encode(name)
		);
	}

	static nextKey = 0;

	// TODO: Should be an empty string instead.
	static empty = new Token('\0');

	static xmlns: Token;

	/** Unique key for storing sets of tokens. */
	key = '' + (++Token.nextKey);

	buf: ArrayType;
}
