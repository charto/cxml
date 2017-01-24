// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Rule, HandlerInstance} from './Type';
import {MemberRef} from './MemberRef';

/** Parser state created for each input tag. */

export class State {
	constructor(parent: State | null, memberRef: MemberRef, type: Rule, item: HandlerInstance) {
		this.parent = parent;
		this.memberRef = memberRef;
		this.rule = type;
		this.item = item;

		if(parent) {
			this.namespaceTbl = parent.namespaceTbl;
		} else {
			this.namespaceTbl = {};
		}
	}

	/** Add a new xmlns prefix recognized inside current tag and its children. */

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

	parent: State | null;
	/** Tag metadata in schema, defining name and occurrence count. */
	memberRef: MemberRef;
	/** Tag type in schema, defining attributes and children. */
	rule: Rule;
	/** Output object for contents of this tag. */
	item: HandlerInstance;
	/** Text content found inside the tag. */
	textList: string[];

	/** Recognized xmlns prefixes. */
	namespaceTbl: { [short: string]: [ Namespace, string ] };
}
