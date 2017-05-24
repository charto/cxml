import { NativeConfig, NativeParser } from './ParserLib';

import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';
import { TokenSpace } from '../tokenizer/TokenSpace';
import { TokenSet } from '../tokenizer/TokenSet';
import { InternalToken } from './InternalToken';
import { TokenKind } from './Token';
import { Parser } from './Parser';

/** Parser configuration for quickly instantiating new parsers.
  * Each parser instance holds a new, cloned copy. */

export class ParserConfig {

	/** Parameters are for internal use only.
	  * @param parent Parent object for cloning.
	  * @param native Reference to C++ object. */
	constructor(parent?: ParserConfig, native?: NativeConfig | null) {
		this.isIndependent = !parent;

		if(parent) {
			this.uriSpace = parent.uriSpace;
			this.prefixSpace = parent.prefixSpace;
			this.elementSpace = parent.elementSpace;
			this.attributeSpace = parent.attributeSpace;

			this.xmlnsToken = parent.xmlnsToken;
			this.xmlnsPrefixToken = parent.xmlnsPrefixToken;

			this.uriSet = parent.uriSet;
			this.prefixSet = parent.prefixSet;

			this.namespaceList = parent.namespaceList;
			this.namespaceTbl = parent.namespaceTbl;
		} else {
			this.uriSpace = new TokenSpace(TokenKind.uri);
			this.prefixSpace = new TokenSpace(TokenKind.prefix);
			this.elementSpace = new TokenSpace(TokenKind.element);
			this.attributeSpace = new TokenSpace(TokenKind.attribute);

			this.xmlnsToken = this.attributeSpace.createToken('xmlns');

			this.uriSet = new TokenSet(this.uriSpace);
			this.prefixSet = new TokenSet(this.prefixSpace);

			this.namespaceList = [];
			this.namespaceTbl = {};
		}

		if(!native) {
			this.xmlnsPrefixToken = this.prefixSet.createToken('xmlns');
			native = new NativeConfig(this.xmlnsPrefixToken.id)
		}

		this.native = native;
	}

	makeIndependent() {
		if(this.isIndependent) return;
		this.isIndependent = true;

		this.uriSpace = new TokenSpace(TokenKind.uri, this.uriSpace);
		this.prefixSpace = new TokenSpace(TokenKind.prefix, this.prefixSpace);
		this.elementSpace = new TokenSpace(TokenKind.element, this.elementSpace);
		this.attributeSpace = new TokenSpace(TokenKind.attribute, this.attributeSpace);

		this.uriSet = new TokenSet(this.uriSpace, this.uriSet);
		this.prefixSet = new TokenSet(this.prefixSpace, this.prefixSet);

		const namespaceTbl: { [ name: string ]: ParserNamespace } = {};
		for(let key of Object.keys(this.namespaceTbl)) {
			namespaceTbl[key] = this.namespaceTbl[key];
		}

		this.namespaceList = this.namespaceList.slice(0);
		this.namespaceTbl = namespaceTbl;
	}

	createParser() {
		const nativeParser = new NativeParser(this.native);
		const config = new ParserConfig(this, nativeParser.getConfig());

		return(new Parser(config, nativeParser));
	}

	addNamespace(nsBase: Namespace) {
		let nsParser = this.namespaceTbl[nsBase.uri];

		if(!nsParser) {
			if(!this.isIndependent) this.makeIndependent();

			nsParser = new ParserNamespace(nsBase, this);
			nsParser.id = this.native.addNamespace(nsParser.registerNative());
			nsParser.uri = this.addUri(nsBase.uri, nsParser);
			if(nsBase.defaultPrefix) {
				nsParser.defaultPrefix = this.addPrefix(nsBase.defaultPrefix);
			}

			this.namespaceList[nsParser.id] = nsParser;
			this.namespaceTbl[nsBase.uri] = nsParser;
		}

		return(nsParser.id);
	}

	bindNamespace(ns: Namespace | ParserNamespace, prefix?: string) {
		if(ns instanceof Namespace) {
			const base = ns;
			while(!(ns = this.namespaceTbl[base.uri])) this.addNamespace(base);
		}

		prefix = prefix || ns.base.defaultPrefix;

		if(prefix) {
			this.native.bindPrefix(
				this.addPrefix(prefix).id,
				this.addUri(ns.base.uri, ns).id
			);
		}
	}

	bindPrefix(prefix: InternalToken, uri: InternalToken) {
		this.native.bindPrefix(prefix.id, uri.id);
	}

	addUri(uri: string, ns: ParserNamespace) {
		if(!this.isIndependent) this.makeIndependent();

		const token = this.uriSet.createToken(uri);

		this.native.setUriTrie(this.uriSet.encodeTrie());
		this.native.addUri(token.id, ns.id);

		return(token);
	}

	addPrefix(prefix: string) {
		if(!this.isIndependent) this.makeIndependent();

		const token = this.prefixSet.createToken(prefix);

		this.native.setPrefixTrie(this.prefixSet.encodeTrie());

		return(token);
	}

	/** If false, object is a clone sharing data with a parent object. */
	private isIndependent: boolean;

	/** Reference to C++ object. */
	private native: NativeConfig;

	xmlnsToken: InternalToken;
	xmlnsPrefixToken: InternalToken;

	/** Allocates ID numbers for xmlns uri tokens. */
	uriSpace: TokenSpace;
	/** Allocates ID numbers for xmlns prefix tokens. */
	prefixSpace: TokenSpace;
	/** Allocates ID numbers for element name tokens. */
	elementSpace: TokenSpace;
	/** Allocates ID numbers for attribute name tokens. */
	attributeSpace: TokenSpace;

	uriSet: TokenSet;
	prefixSet: TokenSet;

	/** List of supported namespaces. */
	namespaceList: ParserNamespace[];
	/** Mapping from URI to namespace. */
	namespaceTbl: { [ uri: string ]: ParserNamespace };

}
