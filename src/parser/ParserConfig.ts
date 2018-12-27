import { NativeConfig, NativeParser } from './ParserLib';

import { Namespace } from '../Namespace';
import { ParserNamespace } from './ParserNamespace';
import { TokenSpace } from '../tokenizer/TokenSpace';
import { TokenSet } from '../tokenizer/TokenSet';
import { InternalToken } from './InternalToken';
import { TokenChunk } from './TokenChunk';
import { TokenKind, MemberToken, OpenToken, CloseToken, EmittedToken, StringToken } from './Token';
import { Parser } from './Parser';
import { XModuleTable } from './JSX';

export interface ParserOptions {
	parseUnknown?: boolean;
	omitDefaults?: boolean;
}

export interface TokenTbl {
	[ prefix: string ]: {
		uri: string,
		elements?: string[],
		attributes?: string[]
	}
}

export interface Registry {
	tokens: { [ name: string ]: MemberToken };
	elements: { [ id: number ]: string };
	attributes: { [ id: number ]: string };
}

/** Parser configuration for quickly instantiating new parsers.
  * Each parser instance holds a new, cloned copy. */

export class ParserConfig {

	/** XML parser configuration.
	  * @param config Parent object for cloning.
	  * @param native Reference to C++ object. For internal use only. */
	constructor(config?: ParserOptions | ParserConfig, native?: NativeConfig | null) {
		if(config instanceof ParserConfig) {
			config.link();
			this.isLinked = true;

			this.options = config.options;

			this.uriSpace = config.uriSpace;
			this.prefixSpace = config.prefixSpace;
			this.elementSpace = config.elementSpace;
			this.attributeSpace = config.attributeSpace;

			this.xmlnsToken = config.xmlnsToken;

			this.emptyPrefixToken = config.emptyPrefixToken;
			this.xmlnsPrefixToken = config.xmlnsPrefixToken;
			this.processingPrefixToken = config.processingPrefixToken;

			this.uriSet = config.uriSet;
			this.prefixSet = config.prefixSet;

			this.namespaceList = config.namespaceList;
			this.namespaceTbl = config.namespaceTbl;
			this.maxNamespace = config.maxNamespace;

			this.nsMapper = config.nsMapper;
		} else {
			this.isLinked = false;

			this.options = config || {};

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

		// this.clonedNamespaceCount = this.maxNamespace;

		if(!native) {
			this.emptyPrefixToken = this.prefixSet.createToken('');
			this.xmlnsPrefixToken = this.prefixSet.createToken('xmlns');
			this.processingPrefixToken = this.prefixSet.createToken('?');

			native = new NativeConfig(this.xmlnsToken.id, this.emptyPrefixToken.id, this.xmlnsPrefixToken.id, this.processingPrefixToken.id);
		}

		this.native = native;

		if(!this.isLinked && !this.options.omitDefaults) {
			this.bindNamespace(Namespace.processing);
			this.bindNamespace(Namespace.unknown);
			this.bindNamespace(Namespace.xml1998);
		}
	}

	link() {
		this.isLinked = true;

		this.uriSpace.link();
		this.prefixSpace.link();
		this.elementSpace.link();
		this.attributeSpace.link();

		this.uriSet.link();
		this.prefixSet.link();
	}

	unlink() {
		if(!this.isLinked) return;
		this.isLinked = false;

		this.uriSpace = new TokenSpace(TokenKind.uri, this.uriSpace);
		this.prefixSpace = new TokenSpace(TokenKind.prefix, this.prefixSpace);
		this.elementSpace = new TokenSpace(TokenKind.element, this.elementSpace);
		this.attributeSpace = new TokenSpace(TokenKind.attribute, this.attributeSpace);

		this.uriSet = new TokenSet(this.uriSpace, this.uriSet);
		this.prefixSet = new TokenSet(this.prefixSpace, this.prefixSet);

		const namespaceList = this.namespaceList.slice(0);
		let num = namespaceList.length;

		while(num--) {
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

	parseSync(data: string) {
		return(this.createParser().parseSync(data));
	}

	getNamespace(uri: string) {
		const ns = this.namespaceTbl[uri];
		return(ns && ns.base);
	}

	addNamespace(nsBase: Namespace) {
		let uri = (this.nsMapper && this.nsMapper(nsBase.uri)) || nsBase.uri;
		let nsParser = this.namespaceTbl[uri];

		if(nsParser) return(nsParser.id);

		this.unlink();

		nsBase.uri = uri;
		nsParser = new ParserNamespace(nsBase, this);
		nsParser.id = this.native.addNamespace(nsParser.registerNative());

		this.namespaceList[nsParser.id] = nsParser;
		this.namespaceTbl[uri] = nsParser;

		if(nsBase.id > this.maxNamespace) this.maxNamespace = nsBase.id;

		if(nsBase.defaultPrefix) this.addPrefix(nsBase.defaultPrefix);
		this.addUri(uri, nsParser);

		return(nsParser.id);
	}

	bindNamespace(nsBase: Namespace, prefix?: string, parser?: Parser) {
		this.addNamespace(nsBase);

		let uri = (this.nsMapper && this.nsMapper(nsBase.uri)) || nsBase.uri;
		let nsParser = this.namespaceTbl[uri];

		if(!prefix && prefix != '') prefix = nsParser.base.defaultPrefix;

		(parser || this).bindPrefix(
			this.addPrefix(prefix),
			this.addUri(uri, nsParser)
		);

		return(nsParser.id);
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
		this.unlink();

		const token = this.uriSet.createToken(uri);

		this.native.setUriTrie(this.uriSet.encodeTrie());
		this.native.addUri(token.id, ns.id);

		return(token);
	}

	addPrefix(prefix: string) {
		this.unlink();

		const token = this.prefixSet.createToken(prefix);

		this.native.setPrefixTrie(this.prefixSet.encodeTrie());

		return(token);
	}

	registerTokens(tbl: TokenTbl): Registry {
		const registry = this.registry;
		let token: MemberToken;
		let qname: string;

		for(let prefix of Object.keys(tbl)) {
			const spec = tbl[prefix];
			const uri = spec.uri;
			const ns = this.getNamespace(uri) || new Namespace(prefix, uri);

			for(let name of spec.elements || []) {
				const tokens = this.getElementTokens(ns, name);
				token = tokens[TokenKind.open]!;
				qname = prefix + ':' + name;

				registry.tokens[qname] = token;
				registry.elements[token.id!] = qname;
			}

			for(let name of spec.attributes || []) {
				const tokens = this.getAttributeTokens(ns, name);
				token = tokens[TokenKind.string]!;
				qname = prefix + ':' + name;

				registry.tokens[qname] = token;
				registry.attributes[token.id!] = qname;
			}
		}

		return(this.registry);
	}

	jsxRegister<Module extends XModuleTable>(spec: Module): Module;

	jsxRegister<Module extends XModuleTable, Result>(spec: Module, handler?: (result: Module) => Result): Result;

	jsxRegister<Module extends XModuleTable, Result>(spec: Module, handler?: (result: Module) => Result) {
		const result: { [prefix: string]: { [name: string]: OpenToken | StringToken }} = {};
		let token: OpenToken | StringToken;

		for(let prefix of Object.keys(spec)) {
			const elements = (spec as any)[prefix];
			const uri = elements.xmlns;
			const ns = this.getNamespace(uri) || new Namespace(prefix, uri);
			result[prefix] = {};

			for(let name of Object.keys(elements)) {
				if(name == 'xmlns') continue;

				if(elements[name]) {
					token = this.getElementTokens(ns, name)[TokenKind.open]!;
				} else {
					token = this.getAttributeTokens(ns, name)[TokenKind.string]!;
				}

				result[prefix][name] = token;
			}
		}

		return(handler ? handler(result as Module) : result as Module);
	}

	getElementTokens(ns: Namespace, name: string) {
		const id = this.addNamespace(ns);
		return(this.namespaceList[id].addElement(name).tokenList);
	}

	getAttributeTokens(ns: Namespace, name: string) {
		const id = this.addNamespace(ns);
		return(this.namespaceList[id].addAttribute(name).tokenList);
	}

	/** If true, object is a clone sharing data with another object. */
	private isLinked: boolean;

	/** Reference to C++ object. */
	private native: NativeConfig;

	options: ParserOptions;

	xmlnsToken: InternalToken;
	emptyPrefixToken: InternalToken;
	xmlnsPrefixToken: InternalToken;
	processingPrefixToken: InternalToken;

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
	// clonedNamespaceCount: number;

	registry: Registry = { tokens: {}, elements: {}, attributes: {} };

	nsMapper?: (uri: string) => string | null | false | undefined;

}
