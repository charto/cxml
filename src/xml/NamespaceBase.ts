// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {ContextBase} from './ContextBase';

export class NamespaceBase<Context extends ContextBase<Context, Namespace>, Namespace extends NamespaceBase<Context, Namespace>> {
	constructor(name: string, id: number, context: Context) {
		this.name = name;
		this.id = id;
		this.context = context;
	}

	static sanitize(name: string) {
		return(name && name.replace(/\/+$/, ''));
	}

	/** URI identifying the namespace (URN or URL which doesn't need to exist). */
	name: string;
	/** Surrogate key, used internally as a unique namespace ID. */
	id: number;
	context: Context;
}
