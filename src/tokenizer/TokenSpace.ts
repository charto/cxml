import { ParserNamespace } from '../parser/ParserNamespace';
import { InternalToken } from '../parser/InternalToken';
import { TokenKind } from '../parser/Token';

/** Allocates IDs for distinguishing between tokens of the same type. */

export class TokenSpace {

	constructor(private kind: TokenKind, parent?: TokenSpace) {
		if(parent) {
			this.isLinked = true;

			this.idLast = parent.idLast;
			this.list = parent.list;
		} else {
			this.isLinked = false;

			this.idLast = 0;
			this.list = [];
		}
	}

	link() {
		this.isLinked = true;
	}

	private unlink() {
		if(!this.isLinked) return;
		this.isLinked = false;

		this.list = this.list.slice(0);
	}

	createToken(name: string, ns?: ParserNamespace) {
		this.unlink();

		const token = new InternalToken(++this.idLast, this.kind, name, ns);
		this.list[token.id] = token;

		return(token);
	}

	/** If true, object is a clone sharing data with another object. */
	private isLinked: boolean;
	private idLast: number;

	list: InternalToken[];

}
