// This file is part of cxml, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type, TypeSpec} from './Type';
import {MemberBase} from './MemberBase';
import {ItemBase} from './Item';

/** Tuple: name, type ID list, flags, substituted member ID */
export type RawMemberSpec = [ string, number[], number, number ];

export class MemberSpec extends MemberBase<MemberSpec, Namespace, ItemBase<MemberSpec> > {
	constructor(spec: RawMemberSpec, namespace: Namespace) {
		super(ItemBase, spec[0]);

		this.namespace = namespace;
		this.item.parentNum = spec[3];
		var typeNumList = spec[1];
		var flags = spec[2];

		this.isAbstract = !!(flags & MemberSpec.abstractFlag);
		this.isSubstituted = !!(flags & MemberSpec.substitutedFlag);

		if(typeNumList.length == 1) {
			this.typeNum = typeNumList[0];
		} else {
			// TODO: What now? Make sure this is not reached.
			// Different types shouldn't be joined with | in .d.ts, instead
			// they should be converted to { TypeA: TypeA, TypeB: TypeB... }

			console.log(spec);
		}
	}

	define() {
		if(!this.item.defined) {
			this.item.defined = true;

			// Look up member type if available.
			// Sometimes abstract elements have no type.

			if(this.typeNum) {
				this.typeSpec = this.namespace.typeByNum(this.typeNum);
				this.type = this.typeSpec.getType();
			}
		}
	}

	typeNum: number;
	typeSpec: TypeSpec;
	type: Type;
}
