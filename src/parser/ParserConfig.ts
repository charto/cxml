import * as ParserLib from './Lib';

import { Patricia } from '../tokenizer/Patricia';
import { TokenSet } from '../tokenizer/TokenSet';
import { Token } from '../tokenizer/Token';
import { Namespace } from '../Namespace';

import { NativeConfig, NativeParser } from './ParserLib';

export class ParserConfig {
	constructor() {
		this.tokenSet.add(Token.xmlns);
	}

	createNativeParser() {
		return(new NativeParser(this.native));
	}

	addNamespace(ns: Namespace) {
		const id = this.native.addNamespace(ns.getNative(this.tokenSet));

		this.namespaceList[id] = ns;
		this.addUri(ns.uri, ns, id);
		this.addPrefix(ns.prefix);
	}

	addUri(uri: Token, ns: Namespace, idNamespace?: number) {
		if(!uri.name) return;

		const idUri = this.uriSet.add(uri);
		let spec = this.namespaceTbl[ns.uri.name];

		if(spec && spec.ns == ns) {
			idNamespace = spec.id;
		} else if(typeof(idNamespace) == 'number') {
			spec = { id: idNamespace, ns };
			this.namespaceTbl[uri.name] = spec;
		} else {
			throw(new Error('Invalid namespace or missing ID'));
		}

		// Map the URI token ID to the namespace in native code.
		// See Parser.cc assignment to namespacePrefixTbl.

		this.native.addUri(idUri, idNamespace);

		this.uriTrie.insertNode(uri);
	}

	addPrefix(prefix: Token) {
		if(!prefix.name) return;

		this.prefixSet.add(prefix);
		this.prefixTrie.insertNode(prefix);
		this.native.setPrefixTrie(this.prefixTrie.encode(this.prefixSet));
	}

	tokenSet = new TokenSet();
	prefixSet = new TokenSet();
	prefixTrie = new Patricia();
	uriSet = new TokenSet();
	uriTrie = new Patricia();

	namespaceTbl: { [uri: string]: { id: number, ns: Namespace } } = {};
	namespaceList: Namespace[] = [];

	private native = new NativeConfig();
}
