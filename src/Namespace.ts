import { ArrayType, concatArray } from './tokenizer/Buffer';
import { TokenSet } from './tokenizer/TokenSet';
import { Token } from './tokenizer/Token';
import { Patricia } from './tokenizer/Patricia';

import { NativeNamespace, NativeConfig } from './parser/ParserLib';

export class Namespace {
	constructor(tokenSet: TokenSet, public defaultPrefix: string, public uri: string) {
		this.native = new NativeNamespace(this.uri);

		this.attributeTrie.insertNode(tokenSet.xmlnsToken);
	}

	addElementTokens(itemList: Token[]) {
		this.elementTrie.insertList(itemList);
	}

	addAttributeTokens(itemList: Token[]) {
		this.attributeTrie.insertList(itemList);
	}

	addToConfig(config: NativeConfig) {
		this.native.setElementTrie(this.elementTrie.encode());
		this.native.setAttributeTrie(this.attributeTrie.encode());

		config.addNamespace(this.native);
	}

	private elementTrie = new Patricia();
	private attributeTrie = new Patricia();

	private native: NativeNamespace;
}
