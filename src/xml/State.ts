// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type, HandlerInstance} from './Type';
import {MemberRef} from './Member';

export class State {
	constructor(parent: State, memberRef: MemberRef, type: Type, item: HandlerInstance) {
		this.parent = parent;
		this.memberRef = memberRef;
		this.type = type;
		this.item = item;

		if(parent) {
			this.namespaceTbl = parent.namespaceTbl;
		} else {
			this.namespaceTbl = {};
		}
	}

	addNamespace(short: string, namespace: Namespace) {
		var key: string;
		var namespaceTbl = this.namespaceTbl;

		if(this.parent && namespaceTbl == this.parent.namespaceTbl) {
			namespaceTbl = {};

			for(key of Object.keys(this.parent.namespaceTbl)) {
				namespaceTbl[key] = this.parent.namespaceTbl[key];
			}

			this.namespaceTbl = namespaceTbl;
		}

		namespaceTbl[short] = [ namespace, namespace.getPrefix() ];
	}

	parent: State;
	memberRef: MemberRef;
	type: Type;
	item: HandlerInstance;
	textList: string[];

	namespaceTbl: { [short: string]: [ Namespace, string ] };
}
