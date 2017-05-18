import { ParserNamespace } from '../parser/ParserNamespace';
import { InternalToken } from '../parser/InternalToken';
import { TokenKind } from '../parser/Token';

/** Allocates IDs for distinguishing between tokens of the same type. */

export class TokenSpace {

	constructor(private kind: TokenKind, parent?: TokenSpace) {
		this.isIndependent = !parent;

		if(parent) {
			this.idLast = parent.idLast;
			this.list = parent.list;
		} else {
			this.idLast = 0;
			this.list = [];
		}
	}

	private makeIndependent() {
		if(this.isIndependent) return;
		this.isIndependent = true;

		this.list = this.list.slice(0);
	}

	createToken(name: string, ns?: ParserNamespace) {
		if(!this.isIndependent) this.makeIndependent();

		const token = new InternalToken(++this.idLast, this.kind, name, ns);
		this.list[token.id] = token;

		return(token);
	}

	/** If false, object is a clone sharing data with a parent object. */
	private isIndependent: boolean;
	private idLast: number;

	list: InternalToken[];

}
