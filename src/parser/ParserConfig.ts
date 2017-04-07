import * as ParserLib from './Lib';

import { Patricia } from '../tokenizer/Patricia';
import { TokenSet } from '../tokenizer/TokenSet';
import { Namespace } from '../Namespace';

import { NativeConfig, NativeParser } from './ParserLib';

export class ParserConfig {
	constructor() {
		this.prefixTrie.insertNode(this.prefixSet.xmlnsToken);
	}

	createNativeParser() {
		return(new NativeParser(this.native));
	}

	addNamespace(ns: Namespace) {
		const id = ns.addToConfig(this.native);
		const uriToken = this.uriSet.add(ns.uri);

		// TODO: C++ needs to know how to map a URI token ID to a namespace.
		// See Parser.cc assignment to namespacePrefixTbl.

		this.uriTrie.insertNode(uriToken);
	}

	prefixSet = new TokenSet();
	prefixTrie = new Patricia();
	uriSet = new TokenSet();
	uriTrie = new Patricia();

	private native = new NativeConfig();
}
