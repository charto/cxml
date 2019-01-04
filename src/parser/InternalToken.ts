import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';
import { ArrayType, encodeArray } from '../Buffer';
import { TokenKind, OpenToken, CloseToken, EmittedToken, StringToken, PrefixToken, UriToken } from './Token';

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

				this.open = new OpenToken(name, nsBase, id);
				this.close = this.open.close;
				this.emitted = this.open.emitted;
				this.tokenList = [
					this.open,
					this.close,
					this.emitted,
					null
				];
				break;

			case TokenKind.attribute:

				this.string = new StringToken(name, nsBase, id);
				this.tokenList = [
					null,
					null,
					null,
					this.string
				];
				break;

			case TokenKind.prefix:
				this.prefix = new PrefixToken(name, id);
				break;

			case TokenKind.uri:
				this.uri = new UriToken(ns!.base);
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

	prefix: PrefixToken;
	uri: UriToken;

	// Order must match TokenKind.
	tokenList: [
		OpenToken | null,
		CloseToken | null,
		EmittedToken | null,
		StringToken | null
	];
}
