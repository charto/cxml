import { Namespace } from '../Namespace';
import { Token } from './Token';
import { NOT_FOUND } from './Patricia';

export class TokenSet {
	constructor() {
		this.tokenTbl[Token.empty.key] = NOT_FOUND;
	}

	clone() {
		const other = new TokenSet();

		other.tokenTbl = {};
		other.list = this.list.slice(0);
		other.lastNum = this.lastNum;

		for(let key of Object.keys(this.tokenTbl)) {
			other.tokenTbl[key] = this.tokenTbl[key];
		}

		return(other);
	}

	add(token: Token) {
		let id = this.tokenTbl[token.key];

		if(!id && id !== 0) {
			id = ++this.lastNum;

			this.tokenTbl[token.key] = id;
			this.list[id] = token;
		}

		return(id);
	}

	encode(token: Token) {
		return(this.tokenTbl[token.key]);
	}

	private tokenTbl: { [key: string]: number } = {};

	list: Token[] = [];
	lastNum = -1;
}
