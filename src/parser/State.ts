// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from '../xml/Namespace';
import {Rule, HandlerInstance} from './Rule';
import {MemberRef} from '../xml/MemberRef';

/** Parser state created for each input tag. */

export class State {
	constructor(
		parent: State | null,
		memberRef: MemberRef,
		type: Rule,
		item: HandlerInstance,
		namespaceTbl: { [short: string]: [ Namespace, string ] }
	) {
		this.parent = parent;
		this.memberRef = memberRef;
		this.rule = type;
		this.item = item;
		this.namespaceTbl = namespaceTbl;
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
