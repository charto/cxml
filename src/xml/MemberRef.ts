// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './Member';
import {MemberRefBase} from './MemberRefBase';

/** Tuple: member ID, flags, name */
export type RawRefSpec = [ number | MemberSpec, number, string ];

export class MemberRef extends MemberRefBase<MemberSpec> {
	constructor(spec: RawRefSpec, namespace: Namespace, proxy?: MemberRef) {
		var flags = spec[1];
		var member: MemberSpec;

		if(typeof(spec[0]) == 'number') member = namespace.memberByNum(spec[0] as number);
		else member = spec[0] as MemberSpec;

		super(
			member,
			(flags & MemberRef.optionalFlag) ? 0 : 1,
			(flags & MemberRef.arrayFlag) ? Infinity : 1
		);

		this.safeName = spec[2] || this.member.safeName;

		if(member.isSubstituted) proxy = this;
		if(proxy) this.proxy = proxy;
	}

	proxy: MemberRef;
}
