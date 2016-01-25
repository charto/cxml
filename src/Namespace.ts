import { ArrayType, concatArray } from './tokenizer/Buffer';
import { Token } from './tokenizer/Token';
import { Patricia } from './tokenizer/Patricia';

export class Namespace {
	constructor(uri: string, defaultPrefix: string) {
		this.uri = uri;
		this.defaultPrefix = defaultPrefix;
	}

	addElementTokens(itemList: Token[]) {
		this.elementTrie.insertList(itemList);
	}

	addAttributeTokens(itemList: Token[]) {
		this.attributeTrie.insertList(itemList);
	}

	encode() {
		const offsetList = new ArrayType(3);
		const elementData = this.elementTrie.encode();
		const attributeData = this.attributeTrie.encode();

		let len = offsetList.length + elementData.length;

		offsetList[0] = len >> 16;
		offsetList[1] = len >> 8;
		offsetList[2] = len;

		len += attributeData.length;

		return(concatArray([ offsetList, elementData, attributeData ], len));
	}

	uri: string;
	defaultPrefix: string;

	elementTrie = new Patricia();
	attributeTrie = new Patricia();
}
