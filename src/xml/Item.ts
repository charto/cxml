// This file is part of cxml, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

/** Type or member. */

export interface Item<ItemContent> {
	define(): void;
	item: ItemContent;
}

/** Type and member dependency helper. Should be parent class of both. */

export class ItemBase<Type extends Item<ItemBase<Type>>> {
	constructor(type: Type) {
		this.type = type;
	}

	setParent(parent: Type) {
		this.parent = parent;

		if(parent.item.defined) {
			// Entire namespace for substituted member is already fully defined,
			// so the substituted member's dependentList won't get processed any more
			// and we should process this member immediately.

			this.define();
		} else if(parent != this.type) parent.item.dependentList.push(this.type);
	}

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
	parentNum: number;
	/** Parent type or substitution group. */
	parent: Type;

	/** Track dependents for Kahn's topological sort algorithm. */
	dependentList: Type[] = [];

	defined: boolean;
}
