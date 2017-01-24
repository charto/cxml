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
	constructor(spec: RawRefSpec, namespace: Namespace, proxy?: MemberRef) {
		var flags = spec[1];
		var member: MemberSpec;

		if(typeof(spec[0]) == 'number') member = namespace.memberByNum(spec[0] as number);
		else member = spec[0] as MemberSpec;

		this.member = member;
		this.min = (flags & MemberRefFlag.optional) ? 0 : 1;
		this.max = (flags & MemberRefFlag.array) ? Infinity : 1;

		this.safeName = spec[2] || this.member.safeName;

		if(member.isSubstituted) proxy = this;
		if(proxy && this.max > 1) this.proxy = proxy;
	}

	member: MemberSpec;
	min: number;
	max: number;

	safeName: string;

	proxy: MemberRef;
}
