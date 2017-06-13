import { NativeConfig, NativeParser } from './ParserLib';

import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';
import { TokenSpace } from '../tokenizer/TokenSpace';
import { TokenSet } from '../tokenizer/TokenSet';
import { InternalToken } from './InternalToken';
import { TokenKind, OpenToken, CloseToken, EmittedToken, StringToken } from './Token';
import { Parser } from './Parser';

export interface TokenTbl {
	[ prefix: string ]: {
		uri: string,
		elements?: string[],
		attributes?: string[]
	}
}

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
			this.maxNamespace = parent.maxNamespace;

			this.nsMapper = parent.nsMapper;
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
			this.maxNamespace = 0;
		}

		this.clonedNamespaceCount = this.maxNamespace;

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

		const namespaceList = this.namespaceList.slice(0);
		for(let num = 0; num < this.clonedNamespaceCount; ++num) {
			let ns = namespaceList[num];

			// This just skips namespace 0 which never exists
			// (see ParserConfig.cc).
			if(ns) {
				ns = new ParserNamespace(ns, this);
				ns.id = num;
				namespaceList[num] = ns;
			}
		}

		const namespaceTbl: { [ name: string ]: ParserNamespace } = {};
		for(let key of Object.keys(this.namespaceTbl)) {
			namespaceTbl[key] = namespaceList[this.namespaceTbl[key].id];
		}

		this.namespaceList = namespaceList;
		this.namespaceTbl = namespaceTbl;
	}

	createParser() {
		const nativeParser = new NativeParser(this.native);
		const config = new ParserConfig(this, nativeParser.getConfig());

		return(new Parser(config, nativeParser));
	}

	getNamespace(uri: string) {
		const ns = this.namespaceTbl[uri];
		return(ns && ns.base);
	}

	addNamespace(nsBase: Namespace) {
		let uri = nsBase.uri;
		let newUri: string | null | false | undefined;
		let nsParser = this.namespaceTbl[uri];

		if(!nsParser) {
			if(!this.isIndependent) this.makeIndependent();

			if(this.nsMapper) {
				newUri = this.nsMapper(uri);

				if(newUri) {
					nsParser = this.namespaceTbl[newUri];
					nsBase.uri = newUri;
				}
			}

			if(!nsParser) {
				nsParser = new ParserNamespace(nsBase, this);
				nsParser.id = this.native.addNamespace(nsParser.registerNative());
				this.namespaceList[nsParser.id] = nsParser;
				if(nsBase.id > this.maxNamespace) this.maxNamespace = nsBase.id;

				if(newUri) {
					this.addUri(newUri, nsParser);
					this.namespaceTbl[newUri] = nsParser;
				}
			}

			if(nsBase.defaultPrefix) this.addPrefix(nsBase.defaultPrefix);

			this.addUri(uri, nsParser);
			this.namespaceTbl[uri] = nsParser;
		}

		return(nsParser.id);
	}

	bindNamespace(ns: Namespace | ParserNamespace, prefix?: string) {
		if(ns instanceof Namespace) {
			const base = ns;
			while(!(ns = this.namespaceTbl[base.uri])) this.addNamespace(base);
		}

		prefix = prefix || ns.base.defaultPrefix;
		const uri = ns.base.uri;

		if(prefix) {
			const idPrefix = this.addPrefix(prefix).id;
			const idUri = this.addUri(uri, ns).id;
			this.native.bindPrefix(idPrefix, idUri);

			if(ns.base.uri != uri) {
				this.native.bindPrefix(
					idPrefix,
					this.addUri(ns.base.uri, ns).id
				);
			}
		}

		return(ns.id);
	}

	updateNamespaces() {
		const list = this.namespaceList;
		const len = list.length;

		for(let num = 0; num < len; ++num) {
			if(list[num]) list[num].registerNative();
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

	registerTokens(tbl: TokenTbl) {
		const result: { [ name: string ]: number } = {};

		for(let prefix of Object.keys(tbl)) {
			const spec = tbl[prefix];
			const uri = spec.uri;
			const ns = this.getNamespace(uri) || new Namespace(prefix, uri);

			for(let name of spec.elements || []) {
				const tokens = this.getElementTokens(ns, name);
				result[prefix + ':' + name] = tokens[TokenKind.open]!.id!;
			}

			for(let name of spec.attributes || []) {
				const tokens = this.getAttributeTokens(ns, name);
				result[prefix + ':' + name] = tokens[TokenKind.string]!.id!;
			}
		}

		return(result);
	}

	getElementTokens(ns: Namespace, name: string) {
		const id = this.addNamespace(ns);
		return(this.namespaceList[id].addElement(name).tokenList);
	}

	getAttributeTokens(ns: Namespace, name: string) {
		const id = this.addNamespace(ns);
		return(this.namespaceList[id].addAttribute(name).tokenList);
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
	private namespaceTbl: { [ uri: string ]: ParserNamespace };
	maxNamespace: number;
	clonedNamespaceCount: number;

	nsMapper?: (uri: string) => string | null | false | undefined;

}
