import { ArrayType, concatArray } from './tokenizer/Buffer';
import { TokenSet } from './tokenizer/TokenSet';
import { Token } from './tokenizer/Token';
import { Patricia } from './tokenizer/Patricia';

import { RawNamespace } from './parser/Parser';

export class Namespace {
	constructor(tokenSet: TokenSet, public defaultPrefix: string, public uri: string) {
		this.attributeTrie.insertNode(tokenSet.xmlnsToken);
	}

	addElementTokens(itemList: Token[]) {
		this.elementTrie.insertList(itemList);
	}

	addAttributeTokens(itemList: Token[]) {
		this.attributeTrie.insertList(itemList);
	}

	encode(): RawNamespace {
		const result = new RawNamespace();

		result.setElementTrie(this.elementTrie.encode());
		result.setAttributeTrie(this.attributeTrie.encode());

		return(result);
	}

	elementTrie = new Patricia();
	attributeTrie = new Patricia();
}
