// This file is part of cxml, copyright (c) 2015-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

/** Type or member. */

export interface Item<ItemContent> {
	define(): void;
	item: ItemContent;
}

/** Type and member dependency helper. Implements Kahn's topological sort. */

export class ItemBase<Type extends Item<ItemBase<Type>>> {
	/** @param type Type or member instance containing this helper. */

	constructor(type: Type) {
		this.type = type;
	}

	/** Set parent type or substituted member. */

	setParent(parent: Type) {
		this.parent = parent;
		this.defined = false;

		if(parent.item.defined) {
			// Entire namespace for substituted member is already fully defined,
			// so the substituted member's dependentList won't get processed any more
			// and we should process this member immediately.

			this.define();
		} else if(parent != this.type) parent.item.dependentList.push(this.type);
	}

	/** Topological sort visitor. */

	define() {
		if(!this.defined) {
			this.defined = true;

			this.type.define();
		}

		for(var dependent of this.dependentList) {
			dependent.item.define();
		}

		this.dependentList = [];
	}

	/** Type or member. */
	type: Type;
	/** Number of parent type or substituted member. */
	parentNum: number;
	/** Parent type or substituted member. */
	parent: Type;

	/** Track dependents for Kahn's topological sort algorithm. */
	private dependentList: Type[] = [];

	/** Visited flag for topological sort. */
	defined: boolean;
}
