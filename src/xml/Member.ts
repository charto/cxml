// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Type} from './Type';

/** Tuple: name, flags, type ID list */
export type MemberSpec = [ string, number, number[] ];

export class Member {
//	name: string;
//	namespace: Namespace;
	safeName: string;

	min: number;
	max: number;

	type: Type;
}
