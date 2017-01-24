// This file is part of cxml, copyright (c) 2015-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type} from './Type';
import {TypeSpec, parseName} from './TypeSpec';
import {MemberRef} from './MemberRef';
import {Item} from './Item';

/** Tuple: name, type ID list, flags, substituted member ID */
export type RawMemberSpec = [ string, number[], number, number ];

export const enum MemberFlag {
	abstract = 1,
	substituted = 2,
	any = 4
}

/** Represents a child element or attribute. */

export class MemberSpec extends Item {
	constructor(spec: RawMemberSpec, namespace: Namespace) {
		var parts = parseName(spec[0]);

		super(spec[3]);
		this.name = parts.name;
		this.safeName = parts.safeName;

		this.namespace = namespace;
		var typeNumList = spec[1];
		var flags = spec[2];

		this.isAbstract = !!(flags & MemberFlag.abstract);
		this.isSubstituted = this.isAbstract || !!(flags & MemberFlag.substituted);

		if(this.isSubstituted) this.containingTypeList = [];

		if(typeNumList.length == 1) {
			this.typeNum = typeNumList[0];
		} else {
			// TODO: What now? Make sure this is not reached.
			// Different types shouldn't be joined with | in .d.ts, instead
			// they should be converted to { TypeA: TypeA, TypeB: TypeB... }

			console.error('Member with multiple types: ' + parts.name);
		}
	}

	init() {
		// Look up member type if available.
		// Sometimes abstract elements have no type.

		if(this.typeNum) {
			this.typeSpec = this.namespace.typeByNum(this.typeNum);
			this.type = this.typeSpec.getType();

			if(!this.type) this.setDependency(this.typeSpec);
		}

		if(this.isSubstituted) {
			this.proxySpec = new TypeSpec([0, 0, [], []], this.namespace, '');
			this.proxySpec.substituteList = [];
			if(!this.isAbstract) this.proxySpec.addSubstitute(this, this);
		}

		if(this.dependency && this.dependency instanceof MemberSpec) {
			// Parent is actually the substitution group base element.
			this.dependency.proxySpec.addSubstitute(this.dependency, this);
		}
	}

	name: string;
	namespace: Namespace;
	safeName: string;

	isAbstract: boolean;
	isSubstituted: boolean;

	typeNum: number;
	typeSpec: TypeSpec;
	type: Type;

	/** Substitution group virtual type,
	  * containing all possible substitutes as children. */
	proxySpec: TypeSpec;

	/** All types containing this member, to be modified if more substitutions
	  * for this member are declared later. */
	containingTypeList: {
		type: TypeSpec,
		head: MemberRef,
		proxy: MemberRef
	}[];
}
