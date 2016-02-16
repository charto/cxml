// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type, HandlerInstance} from './Type';
import {Member} from './Member';

export class State {
	constructor(parent: State, memberSpec: Member, type: Type, item: HandlerInstance) {
		this.parent = parent;
		this.memberSpec = memberSpec;
		this.type = type;
		this.item = item;

		if(parent) {
			this.namespacePrefixTbl = parent.namespacePrefixTbl;
		} else {
			this.namespacePrefixTbl = {};
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
	memberSpec: Member;
	type: Type;
	item: HandlerInstance;
	textList: string[];

	namespacePrefixTbl: { [short: string]: string };
}
