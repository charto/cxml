import * as ParserLib from './Lib';

import { Namespace } from '../Namespace';

import { NativeConfig, NativeParser } from './ParserLib';

export class ParserConfig {
	createNativeParser() {
		return(new NativeParser(this.native));
	}

	addNamespace(ns: Namespace) {
		this.native.addNamespace(ns.encode());
	}

	private native = new NativeConfig();
}
