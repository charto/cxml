import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';

// Order must match InternalToken.tokenList.
export const enum TokenKind {
	// External element token types
	open,
	close,
	emitted,

	// External attribute token types
	string,
	number,

	comment,

	// Internal token types
	uri,
	prefix,
	element,
	attribute
}

export abstract class Token {

	kind: TokenKind;

}

export class SpecialToken extends Token {

	constructor(public kind: TokenKind) { super(); }

	static comment = new SpecialToken(TokenKind.comment);

}

export abstract class MemberToken extends Token {

	constructor(public name: string, public ns: Namespace) { super(); }

	abstract resolve(ns: ParserNamespace): Token;

}

export class ElementToken extends MemberToken {

	resolve(ns: ParserNamespace) {
		return(ns.addElement(this.name).tokenList[this.kind]!);
	}

}

export class AttributeToken extends MemberToken {

	resolve(ns: ParserNamespace) {
		return(ns.addAttribute(this.name).tokenList[this.kind]!);
	}

}

export class OpenToken extends ElementToken {
	emitted = new EmittedToken(this.name, this.ns);
	close = new CloseToken(this.name, this.ns);
}
OpenToken.prototype.kind = TokenKind.open;

export class CloseToken extends ElementToken {}
CloseToken.prototype.kind = TokenKind.close;

export class EmittedToken extends ElementToken {}
EmittedToken.prototype.kind = TokenKind.emitted;

export class StringToken extends AttributeToken {}
StringToken.prototype.kind = TokenKind.string;
