import { NativeNamespace } from './ParserLib';

import { Namespace } from '../Namespace';
import { ParserConfig } from './ParserConfig';
import { Token } from './Token';
import { TokenSet } from '../tokenizer/TokenSet';
import { InternalToken } from './InternalToken';

export class ParserNamespace {

	/** @param base Parser-independent namespace definition. */
	constructor(public parent: Namespace | ParserNamespace, config: ParserConfig) {
		if(parent instanceof ParserNamespace) {
			this.base = parent.base;
			this.native = parent.native.clone();

			this.elementSet = new TokenSet(config.elementSpace, parent.elementSet);
			this.attributeSet = new TokenSet(config.attributeSpace, parent.attributeSet);

			this.uriToken = parent.uriToken;
		} else {
			this.base = parent;
			this.native = new NativeNamespace(parent.uri);

			this.elementSet = new TokenSet(config.elementSpace);
			this.attributeSet = new TokenSet(config.attributeSpace);

			this.attributeSet.addToken(config.xmlnsToken);

			for(let name of parent.elementNameList) {
				this.addElement(name);
			}

			for(let name of parent.attributeNameList) {
				this.addAttribute(name);
			}
		}
	}

	registerNative(): NativeNamespace {
		if(this.elementSet.dirty) {
			this.native.setElementTrie(this.elementSet.encodeTrie());
			this.elementSet.dirty = false;
		}
		if(this.attributeSet.dirty) {
			this.native.setAttributeTrie(this.attributeSet.encodeTrie());
			this.attributeSet.dirty = false;
		}
		return(this.native);
	}

	addElement(name: string) {
		return(this.elementSet.createToken(name, this));
	}

	addAttribute(name: string) {
		return(this.attributeSet.createToken(name, this));
	}

	public base: Namespace;
	private native: NativeNamespace;

	/** Index in parser's namespaceList. */
	public id: number;

	uriToken: Token;

	private elementSet: TokenSet;
	private attributeSet: TokenSet;

}
