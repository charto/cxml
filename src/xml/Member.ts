// This file is part of cxml, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type} from './Type';
import {TypeSpec, parseName} from './TypeSpec';
import {MemberBase} from './MemberBase';
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
			this.proxyType = this.proxySpec.define();

			if(!this.isAbstract) this.addSubstitute(this);
		}

		if(this.item.parent) {
			// Parent is actually the substitution group base element.
			this.item.parent.addSubstitute(this);
		}
	}

	addSubstitute(substitute: MemberSpec) {
		// Add substitute as a child of proxyType.
		this.proxySpec.childSpecList = [ [substitute, 0, substitute.safeName] ];
		this.proxySpec.defineMembers();
	}

	typeNum: number;
	typeSpec: TypeSpec;
	type: Type;

	/** Substitution group virtual type,
	  * containing all possible substitutes as children. */
	proxyType: Type;
	proxySpec: TypeSpec;

	containingTypeList: Type[];
}
