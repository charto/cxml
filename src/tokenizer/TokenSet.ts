import { Patricia } from './Patricia';
import { ParserNamespace } from '../parser/ParserNamespace';
import { TokenSpace } from './TokenSpace';
import { InternalToken } from '../parser/InternalToken';

export class TokenSet {

	constructor(private space: TokenSpace, parent?: TokenSet) {
		this.isIndependent = !parent;

		if(parent) {
			this.tbl = parent.tbl;
			this.trie = parent.trie;
		} else {
			this.tbl = {};
			this.trie = new Patricia();
		}
	}

	private makeIndependent() {
		if(this.isIndependent) return;
		this.isIndependent = true;

		const tbl: { [ name: string ]: InternalToken } = {};
		for(let key of Object.keys(this.tbl)) {
			tbl[key] = this.tbl[key];
		}

		this.tbl = tbl;
		this.trie = this.trie.clone();
	}

	createToken(name: string, ns?: ParserNamespace) {
		let token = this.tbl[name];

		if(!token) {
			if(!this.isIndependent) this.makeIndependent();

			token = this.space.createToken(name, ns);

			this.tbl[name] = token;
			if(token.name) this.trie.insertNode(token);
		}

		return(token);
	}

	encodeTrie() { return(this.trie.encode()); }

	/** If false, object is a clone sharing data with a parent object. */
	private isIndependent: boolean;

	private tbl: { [ name: string ]: InternalToken };
	private trie: Patricia;

}
