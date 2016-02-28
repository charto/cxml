// This file is part of cxml, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type} from './Type';
import {TypeSpec, parseName} from './TypeSpec';
import {MemberBase} from './MemberBase';
import {MemberRef} from './MemberRef';
import {ItemBase} from './Item';

/** Tuple: name, type ID list, flags, substituted member ID */
export type RawMemberSpec = [ string, number[], number, number ];

export class MemberSpec extends MemberBase<MemberSpec, Namespace, ItemBase<MemberSpec> > {
	constructor(spec: RawMemberSpec, namespace: Namespace) {
		var parts = parseName(spec[0]);

		super(ItemBase, parts.name);
		this.safeName = parts.safeName;

		this.namespace = namespace;
		this.item.parentNum = spec[3];
		var typeNumList = spec[1];
		var flags = spec[2];

		this.isAbstract = !!(flags & MemberSpec.abstractFlag);
		this.isSubstituted = !!(flags & MemberSpec.substitutedFlag);
		this.isSubstituted = this.isSubstituted || this.isAbstract;

		if(this.isSubstituted) {
			this.containingTypeList = [];
		}

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
		// Look up member type if available.
		// Sometimes abstract elements have no type.

		if(this.typeNum) {
			this.typeSpec = this.namespace.typeByNum(this.typeNum);
			this.type = this.typeSpec.getType();
		}

		if(this.isSubstituted) {
			this.proxySpec = new TypeSpec([0, 0, [], []], this.namespace, '');
			this.proxySpec.substituteList = [];
			if(!this.isAbstract) this.proxySpec.addSubstitute(this, this);
		}

		if(this.item.parent) {
			// Parent is actually the substitution group base element.
			this.item.parent.proxySpec.addSubstitute(this.item.parent, this);
		}
	}

	typeNum: number;
	typeSpec: TypeSpec;
	type: Type;

	/** Substitution group virtual type,
	  * containing all possible substitutes as children. */
	proxySpec: TypeSpec;

	/** All types containing this member, to be modified if more substitutions
	  * for this member are declared later. */
	containingTypeList: { type: TypeSpec, proxy: MemberRef }[];
}
