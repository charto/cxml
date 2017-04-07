import { Token } from './Token';

export class TokenSet {
	constructor() {
		this.xmlnsToken = this.add('xmlns');
	}

	clone() {
		const other = new TokenSet();

		other.xmlnsToken = this.xmlnsToken;
		other.list = this.list.slice(0);
		other.lastNum = this.lastNum;

		return(other);
	}

	add(name: string) {
		const token = new Token(name, ++this.lastNum);

		this.list[token.id] = token;
		return(token);
	}

	xmlnsToken: Token;
	list: Token[] = [];
	lastNum = -1;
}
