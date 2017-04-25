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

	addNamespace(ns: Namespace, isBound = false) {
		const idNamespace = this.native.addNamespace(ns.getNative(this.tokenSet));
		const idPrefix = this.addPrefix(ns.prefix);
		const idUri = this.addUri(ns.uri, ns, idNamespace);

		this.namespaceList[idNamespace] = ns;

		if(isBound) this.native.bindPrefix(idPrefix, idUri);

		return(idNamespace);
	}

	bindNamespace(ns: Namespace) {
		this.addNamespace(ns, true);
	}

	addUri(uri: Token, ns: Namespace, idNamespace?: number) {
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

		if(uri.name) this.uriTrie.insertNode(uri);

		return(idUri);
	}

	addPrefix(prefix: Token) {
		const idPrefix = this.prefixSet.add(prefix);

		if(prefix.name) {
			this.prefixTrie.insertNode(prefix);
			// TODO: maybe remove following line and pass xmlns differently?
			this.native.setPrefixTrie(this.prefixTrie.encode(this.prefixSet));
		}

		return(idPrefix);
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
