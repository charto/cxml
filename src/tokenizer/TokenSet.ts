import { Patricia } from './Patricia';
import { ParserNamespace } from '../parser/ParserNamespace';
import { TokenSpace } from './TokenSpace';
import { InternalToken } from '../parser/InternalToken';

export class TokenSet {

	constructor(private space: TokenSpace, parent?: TokenSet) {
		if(parent) {
			this.isLinked = true;

			this.tbl = parent.tbl;
			this.trie = parent.trie;
		} else {
			this.isLinked = false;

			this.tbl = {};
			this.trie = new Patricia();
		}
	}

	link() {
		this.isLinked = true;
	}

	private unlink() {
		if(!this.isLinked) return;
		this.isLinked = false;

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
			this.unlink();

			token = this.space.createToken(name, ns);

			this.tbl[name] = token;
			if(token.name) {
				this.dirty = true;
				this.trie.insertNode(token);
			}
		}

		return(token);
	}

	addToken(token: InternalToken) {
		if(token.name) {
			this.dirty = true;
			this.tbl[token.name] = token;
			this.trie.insertNode(token);
		}
	}

	encodeTrie() {
		return(this.trie.encode());
	}

	/** If true, object is a clone sharing data with another object. */
	private isLinked: boolean;

	private tbl: { [ name: string ]: InternalToken };
	private trie: Patricia;

	public dirty = true;

}
