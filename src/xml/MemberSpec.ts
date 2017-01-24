// This file is part of cxml, copyright (c) 2015-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Rule} from '../parser/Rule';
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
	constructor(name: string, dependencyNum?: number) {
		super(MemberSpec, dependencyNum);
		this.name = name;
	}

	static parseSpec(spec: RawMemberSpec, namespace: Namespace) {
		var parts = parseName(spec[0]);

		const member = new MemberSpec(parts.name, spec[3]);
		member.safeName = parts.safeName;

		member.namespace = namespace;
		var typeNumList = spec[1];
		var flags = spec[2];

		member.isAbstract = !!(flags & MemberFlag.abstract);
		member.isSubstituted = member.isAbstract || !!(flags & MemberFlag.substituted);

		if(member.isSubstituted) member.containingTypeList = [];

		if(typeNumList.length == 1) {
			member.typeNum = typeNumList[0];
		} else {
			// TODO: What now? Make sure this is not reached.
			// Different types shouldn't be joined with | in .d.ts, instead
			// they should be converted to { TypeA: TypeA, TypeB: TypeB... }

			console.error('Member with multiple types: ' + parts.name);
		}

		return(member);
	}

	init() {
		// Look up member type if available.
		// Sometimes abstract elements have no type.

		if(this.typeNum) {
			const typeSpec = this.namespace.typeByNum(this.typeNum);
			this.typeSpecList = [ typeSpec ];
			this.rule = typeSpec.getType();

			if(!this.rule) this.setDependency(typeSpec);
		}

		if(this.isSubstituted) {
			this.proxySpec = new TypeSpec('', this.namespace, [0, 0, [], []]);
			this.proxySpec.substituteList = [];
			if(!this.isAbstract) this.proxySpec.addSubstitute(this, this);
		}

		if(this.dependency && this.dependency instanceof MemberSpec) {
			// Parent is actually the substitution group base element.
			this.dependency.proxySpec.addSubstitute(this.dependency, this);
		}
	}

	getRef() {
		return(new MemberRef(this, 0, 1));
	}

	getProxy() {
		var proxy = this.proxySpec;

		if(!proxy) {
			const proxy = new TypeSpec();

			proxy.isProxy = true;
			proxy.containingRef = this.getRef();

			this.proxySpec = proxy;
			this.namespace.addType(proxy);

			if(!this.isAbstract) {
				// TODO
				// proxy.addChildSpec(this);
			}
		}

		return(proxy);
	}

	name: string;
	namespace: Namespace;
	safeName: string;

	isAbstract: boolean;
	isSubstituted: boolean;

	typeNum: number;
	typeSpecList: TypeSpec[];
	rule: Rule;

	substitutes: MemberSpec;

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

	comment: string;
	isExported: boolean;
}
