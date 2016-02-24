// This file is part of cxml, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type} from './Type';
import {TypeSpec} from './TypeSpec';
import {Item, ItemBase} from './Item';

// TODO: Should extend ItemBase instead of containing it.
// For now, TypeScript doesn't allow ItemBase to extend ItemContent.

export class MemberBase<Member, Namespace, ItemContent extends ItemBase<Item<ItemContent>>> implements Item<ItemContent> {
	constructor(Item: { new(type: MemberBase<Member, Namespace, ItemContent>): ItemContent }, name: string) {
		if(Item) this.item = new Item(this);
		this.name = name;
	}

	define() {}

	item: ItemContent;

	name: string;
	namespace: Namespace;

	isAbstract: boolean;
	isSubstituted: boolean;
	substitutes: Member;

	static abstractFlag = 1;
	static substitutedFlag = 2;
	static anyFlag = 4;
}
