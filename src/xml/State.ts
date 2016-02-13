// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type} from './Type';

export class State {
	constructor(parent: State, type: Type) {
		this.parent = parent;
		this.type = type;

		if(parent) {
			this.namespacePrefixTbl = parent.namespacePrefixTbl;
		} else {
			this.namespacePrefixTbl = {'': ''};
		}
	}

	addNamespace(short: string, namespace: Namespace) {
		var key: string;
		var prefixTbl = this.namespacePrefixTbl;

		if(this.parent && prefixTbl == this.parent.namespacePrefixTbl) {
			prefixTbl = {};

			for(key of Object.keys(this.parent.namespacePrefixTbl)) {
				prefixTbl[key] = this.parent.namespacePrefixTbl[key];
			}

			this.namespacePrefixTbl = prefixTbl;
		}

		prefixTbl[short] = namespace.getPrefix();
	}

	parent: State;
	type: Type;

	namespacePrefixTbl: { [short: string]: string };
}
