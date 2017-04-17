import * as ParserLib from './Lib';

import { Patricia } from '../tokenizer/Patricia';
import { TokenSet } from '../tokenizer/TokenSet';
import { Token } from '../tokenizer/Token';
import { Namespace } from '../Namespace';

import { NativeConfig, NativeParser } from './ParserLib';

export class ParserConfig {
	constructor() {
		this.addPrefix(Token.xmlns);
		this.tokenSet.add(Token.xmlns);
	}

	createNativeParser() {
		return(new NativeParser(this.native));
	}

	addNamespace(ns: Namespace) {
		this.addUri(ns.uri, ns, this.native.addNamespace(ns.getNative(this.tokenSet)));
	}

	addUri(uri: string, ns: Namespace, idNamespace?: number) {
		if(!uri) return;

		const uriToken = new Token(uri);
		const idUri = this.uriSet.add(uriToken);
		let spec = this.namespaceTbl[ns.uri];

		if(spec && spec.ns == ns) {
			idNamespace = spec.id;
		} else if(typeof(idNamespace) == 'number') {
			spec = { id: idNamespace, ns };
			this.namespaceTbl[uri] = spec;
		} else {
			throw(new Error('Invalid namespace or missing ID'));
		}

		// Map the URI token ID to the namespace in native code.
		// See Parser.cc assignment to namespacePrefixTbl.

		this.native.addUri(idUri, idNamespace);

		this.uriTrie.insertNode(uriToken);
	}

	addPrefix(token: Token) {
		this.prefixSet.add(token);
		this.prefixTrie.insertNode(token);
		this.native.setPrefixTrie(this.prefixTrie.encode(this.prefixSet));
	}

	tokenSet = new TokenSet();
	prefixSet = new TokenSet();
	prefixTrie = new Patricia();
	uriSet = new TokenSet();
	uriTrie = new Patricia();

	namespaceTbl: { [uri: string]: { id: number, ns: Namespace } } = {};

	private native = new NativeConfig();
}
