import { NativeNamespace } from './ParserLib';

import { Namespace } from '../Namespace';
import { ParserConfig } from './ParserConfig';
import { TokenSet } from '../tokenizer/TokenSet';
import { InternalToken } from './InternalToken';

export class ParserNamespace {

	/** @param base Parser-independent namespace definition. */
	constructor(public base: Namespace, config: ParserConfig) {
		this.native = new NativeNamespace(base.uri);

		this.elementSet = new TokenSet(config.elementSpace);
		this.attributeSet = new TokenSet(config.attributeSpace);

		this.xmlnsToken = this.attributeSet.createToken('xmlns');

		for(let name of base.elementNameList) {
			this.addElement(name);
		}

		for(let name of base.attributeNameList) {
			this.addAttribute(name);
		}
	}

	registerNative(): NativeNamespace {
		this.native.setElementTrie(this.elementSet.encodeTrie());
		this.native.setAttributeTrie(this.attributeSet.encodeTrie());
		return(this.native);
	}

	addElement(name: string) {
		return(this.elementSet.createToken(name, this));
	}

	addAttribute(name: string) {
		return(this.attributeSet.createToken(name, this));
	}

	private native: NativeNamespace;

	/** Index in parser's namespaceList. */
	public id: number;

	uri: InternalToken;
	defaultPrefix?: InternalToken;
	xmlnsToken: InternalToken;

	private elementSet: TokenSet;
	private attributeSet: TokenSet;

}
