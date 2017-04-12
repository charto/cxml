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
		this.addUri(ns.uri, ns, this.native.addNamespace(ns.getNative()));
	}

	addUri(uri: string, ns: Namespace, id?: number) {
		const uriToken = this.uriSet.add(uri);
		let spec = this.namespaceTbl[ns.uri];

		if(spec && spec.ns == ns) {
			id = spec.id;
		} else if(typeof(id) == 'number') {
			spec = { id, ns };
			this.namespaceTbl[uri] = spec;
		} else {
			throw(new Error('Invalid namespace or missing ID'));
		}

		// Map the URI token ID to the namespace in native code.
		// See Parser.cc assignment to namespacePrefixTbl.

		this.native.addUri(uriToken.id, id);

		this.uriTrie.insertNode(uriToken);
	}

	prefixSet = new TokenSet();
	prefixTrie = new Patricia();
	uriSet = new TokenSet();
	uriTrie = new Patricia();

	namespaceTbl: { [uri: string]: { id: number, ns: Namespace } } = {};

	private native = new NativeConfig();
}
