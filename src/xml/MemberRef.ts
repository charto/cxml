// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './MemberSpec';

/** Tuple: member ID, flags, name */
export type RawRefSpec = [ number | MemberSpec, number, string ];

export const enum MemberRefFlag {
	optional = 1,
	array = 2
}

export class MemberRef {
	constructor(member: MemberSpec, min: number, max: number) {
		this.member = member;
		this.min = min;
		this.max = max;
	}

	static parseSpec(spec: RawRefSpec, namespace: Namespace, proxy?: MemberRef) {
		var flags = spec[1];
		var member: MemberSpec;

		if(typeof(spec[0]) == 'number') member = namespace.memberByNum(spec[0] as number);
		else member = spec[0] as MemberSpec;

		const ref = new MemberRef(
			member,
			(flags & MemberRefFlag.optional) ? 0 : 1,
			(flags & MemberRefFlag.array) ? Infinity : 1
		);

		ref.safeName = spec[2] || member.safeName;

		if(member.isSubstituted) proxy = ref;
		if(proxy && ref.max > 1) ref.proxy = proxy;

		return(ref);
	}

	member: MemberSpec;
	min: number;
	max: number;

	prefix: string;
	safeName: string;

	proxy: MemberRef;
}
