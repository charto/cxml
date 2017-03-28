import { Token } from './Token';

export class TokenSet {
	constructor() {
		this.nsToken = this.add('xmlns');
	}

	add(name: string) {
		const token = new Token(name, this.list.length);

		this.list.push(token);
		return(token);
	}

	nsToken: Token;
	list: Token[] = [];
}
