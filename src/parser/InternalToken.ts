import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';
import { ArrayType, encodeArray } from '../Buffer';
import { TokenKind, OpenToken, CloseToken, EmittedToken, StringToken } from './Token';

export class InternalToken {
	constructor(
		public id: number,
		kind: TokenKind,
		public name: string,
		public ns?: ParserNamespace
	) {
		this.buf = encodeArray(name);
		const nsBase = ns ? ns.base : Namespace.unknown;

		switch(kind) {
			case TokenKind.element:

				this.open = new OpenToken(name, nsBase);
				this.close = new CloseToken(name, nsBase);
				this.emitted = new EmittedToken(name, nsBase);
				break;

			case TokenKind.attribute:

				this.string = new StringToken(name, nsBase);
				break;

			default:

				break;
		}
	}

	// TODO: Should be an empty string instead.
	static empty = new InternalToken(0, TokenKind.element, '\0');

	buf: ArrayType;

	open: OpenToken;
	close: CloseToken;
	emitted: EmittedToken;

	string: StringToken;
}
