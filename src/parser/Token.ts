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
	blank,

	namespace,
	recycle,

	// Internal token types
	uri,
	prefix,
	element,
	attribute
}

export abstract class Token {

	constructor(public id?: number) {}

	kind: TokenKind;

}

export class SpecialToken extends Token {

	constructor(public kind: TokenKind) { super(); }

	static comment = new SpecialToken(TokenKind.comment);
	static blank = new SpecialToken(TokenKind.blank);

}

export class NamespaceToken extends Token {

	constructor(public namespaceList: (Namespace | undefined)[]) { super(); }

}
NamespaceToken.prototype.kind = TokenKind.namespace;

export class RecycleToken extends Token {

	constructor(public lastNum: number) { super(); }

}
RecycleToken.prototype.kind = TokenKind.recycle;

export abstract class MemberToken extends Token {

	constructor(public name: string, public ns: Namespace, id?: number) { super(id); }

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
	emitted = new EmittedToken(this.name, this.ns, this.id);
	close = new CloseToken(this.name, this.ns, this.id);
}
OpenToken.prototype.kind = TokenKind.open;

export class CloseToken extends ElementToken {}
CloseToken.prototype.kind = TokenKind.close;

export class EmittedToken extends ElementToken {}
EmittedToken.prototype.kind = TokenKind.emitted;

export class StringToken extends AttributeToken {}
StringToken.prototype.kind = TokenKind.string;
