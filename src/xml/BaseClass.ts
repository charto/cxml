// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Rule} from './Rule';

/** Common constructor type for schema tag handler classes. */

export interface BaseClass {
//	new(state?: State): Base;

	/** Returns other classes allowed as children. */
	mayContain(): BaseClass[];

//	getNamespace(): Namespace;

	name: string;
	rule: Rule;
}
