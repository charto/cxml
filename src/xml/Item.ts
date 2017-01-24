// This file is part of cxml, copyright (c) 2015-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {TypeSpec} from './TypeSpec';
import {MemberSpec} from './MemberSpec';

export interface ItemType {
	new(...args: any[]): Item;
	nextKey: number;
}

/** Type and member dependency helper. Implements Kahn's topological sort. */

export class Item {
	constructor(kind: ItemType, dependencyNum?: number) {
		this.dependencyNum = dependencyNum;
		this.surrogateKey = kind.nextKey++;
	}

	resolveDependency(specList: Item[]) {
		if(this.dependencyNum) {
			this.setDependency(specList[this.dependencyNum]);
		}
	}

	/** Set parent type or substituted member. */

	setDependency(dependency: Item) {
		this.dependency = dependency;
		this.ready = false;

		if(dependency.ready) {
			// Entire namespace for substituted member is already fully defined,
			// so the substituted member's dependentList won't get processed any more
			// and we should process this member immediately.

			this.tryInit();
		} else if(dependency != this) dependency.dependentList.push(this);
	}

	init() {}

	/** Topological sort visitor. */

	tryInit() {
		if(!this.ready) {
			this.ready = true;

			this.init();
		}

		for(var dependent of this.dependentList) {
			dependent.tryInit();
		}

		this.dependentList = [];
	}

	/** Create types and members based on JSON specifications. */

	static initAll(pendingList: Item[]) {
		for(var spec of pendingList) {
			// If the spec has a parent, it handles defining the child.
			if(!spec.dependency || spec.dependency == spec) {
				spec.tryInit();
			}
		}
	}

	surrogateKey: number;
	static nextKey = 0;

	/** Number of parent type or substituted member. */
	dependencyNum: number;
	/** Parent type or substituted member. */
	dependency: Item;

	/** Track dependents for Kahn's topological sort algorithm. */
	private dependentList: Item[] = [];

	/** Visited flag for topological sort. */
	ready: boolean;
}
