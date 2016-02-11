// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {ContextBase} from './ContextBase';
import {Namespace} from './Namespace';

/** XML parser context, holding definitions of all imported namespaces. */

export class Context extends ContextBase<Context, Namespace> {
	constructor() {
		super(Namespace);
	}
}
