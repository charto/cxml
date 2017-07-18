import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';

// Order must match InternalToken.tokenList.
export const enum TokenKind {
	// External element token types
	open,
	close,
	emitted,
	elementEnd = emitted,

	// External attribute token types
	string,
	number,
	attributeEnd = number,

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

	constructor() {}

	kind: TokenKind;
	kindString: string;

}

export class SpecialToken extends Token {

	constructor(public kind: TokenKind, public kindString: string) { super(); }

	static comment = new SpecialToken(TokenKind.comment, 'comment');
	static blank = new SpecialToken(TokenKind.blank, 'blank');

}

export class NamespaceToken extends Token {

	constructor(public namespaceList: (Namespace | undefined)[]) { super(); }

}
NamespaceToken.prototype.kind = TokenKind.namespace;

export class RecycleToken extends Token {

	constructor(public lastNum: number) { super(); }

}
RecycleToken.prototype.kind = TokenKind.recycle;
RecycleToken.prototype.kindString = 'recycle';

export abstract class MemberToken extends Token {

	constructor(public name: string, public ns: Namespace, public id?: number) { super(); }

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
OpenToken.prototype.kindString = 'open';

export class CloseToken extends ElementToken {}
CloseToken.prototype.kind = TokenKind.close;
CloseToken.prototype.kindString = 'close';

export class EmittedToken extends ElementToken {}
EmittedToken.prototype.kind = TokenKind.emitted;
EmittedToken.prototype.kindString = 'emitted';

export class StringToken extends AttributeToken {}
StringToken.prototype.kind = TokenKind.string;
StringToken.prototype.kindString = 'string';
