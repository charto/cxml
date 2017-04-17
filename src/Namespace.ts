import { ArrayType, concatArray } from './tokenizer/Buffer';
import { TokenSet } from './tokenizer/TokenSet';
import { Token } from './tokenizer/Token';
import { Patricia } from './tokenizer/Patricia';

import { NativeNamespace, NativeConfig } from './parser/ParserLib';

export class Namespace {
	constructor(public defaultPrefix: string, public uri: string) {
		this.native = new NativeNamespace(this.uri);

		this.attributeTrie.insertNode(Token.xmlns);
	}

	addElementTokens(itemList: Token[]) {
		this.elementTrie.insertList(itemList);
	}

	addAttributeTokens(itemList: Token[]) {
		this.attributeTrie.insertList(itemList);
	}

	/** Register namespace contents with native code library. */

	getNative(tokenSet: TokenSet): NativeNamespace {
		this.native.setElementTrie(this.elementTrie.encode(tokenSet));
		this.native.setAttributeTrie(this.attributeTrie.encode(tokenSet));

		return(this.native);
	}

	private elementTrie = new Patricia();
	private attributeTrie = new Patricia();

	private native: NativeNamespace;
}
