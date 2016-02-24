// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './Member';
import {MemberRefBase} from './MemberRefBase';

/** Tuple: member ID, flags, name */
export type RawRefSpec = [ number, number, string ];

export class MemberRef extends MemberRefBase<MemberSpec> {
	constructor(spec: RawRefSpec, namespace: Namespace) {
		var flags = spec[1];

		super(
			namespace.memberByNum(spec[0]),
			(flags & MemberRef.optionalFlag) ? 0 : 1,
			(flags & MemberRef.arrayFlag) ? Infinity : 1
		);

		this.safeName = spec[2] || this.member.name;
	}
}
