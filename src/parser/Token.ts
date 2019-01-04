import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';
import { ParserConfig } from './ParserConfig';

export type TokenBuffer = (Token | number | string)[];

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

	// Internal token types
	uri,
	prefix,
	element,
	attribute,

	other
}

export abstract class Token {

	constructor() {}

	serialize?(indent?: string, data?: any): string | TokenBuffer;
	serializeJson?(indent?: string, data?: any): any;

	kind: TokenKind;
	kindString: string;

}
Token.prototype.kind = TokenKind.other;
Token.prototype.kindString = 'other';

export class SpecialToken extends Token {

	constructor(public kind: TokenKind, public kindString: string) { super(); }

	static comment = new SpecialToken(TokenKind.comment, 'comment');
	static blank = new SpecialToken(TokenKind.blank, 'blank');

}

export abstract class MemberToken extends Token {

	constructor(public name: string, public ns: Namespace, public id?: number) { super(); }

	abstract resolve(ns: ParserNamespace): Token;

}

export class ElementToken extends MemberToken {

	resolve(ns: ParserNamespace) {
		return(ns.addElement(this.name).tokenList[this.kind as number]!);
	}

}

export class AttributeToken extends MemberToken {

	resolve(ns: ParserNamespace) {
		return(ns.addAttribute(this.name).tokenList[this.kind as number]!);
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
