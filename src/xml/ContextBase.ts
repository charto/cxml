// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {NamespaceBase} from './NamespaceBase';

/** XML parser context, holding definitions of all imported namespaces. */

export class ContextBase<Context extends ContextBase<Context, Namespace>, Namespace extends NamespaceBase<Context, Namespace>> {
	constructor(NamespaceType: { new(name: string, id: number, context: Context): Namespace }) {
		this.NamespaceType = NamespaceType;
	}

	getNamespace(name: string) {
		return(this.namespaceNameTbl[name]);
	}

	/** Create or look up a namespace by name in URI (URL or URN) format. */

	registerNamespace(name: string) {
		// OLD INCORRECT COMMENT: When importing a remote schema file, its namespace name may be unknown.
		name = NamespaceBase.sanitize(name);
		var namespace = this.namespaceNameTbl[name];

		if(!namespace) {
			// Create a new namespace.

			var id = this.namespaceKeyNext++;
			namespace = new this.NamespaceType(name, id, this as any as Context);

			this.namespaceNameTbl[name] = namespace;
			this.namespaceList[id] = namespace;
		}

		return(namespace);
	}

	/** Look up namespace by internal numeric surrogate key. */

	namespaceById(id: number) {
		return(this.namespaceList[id]);
	}

	/** Constructor for namespaces in this context. */
	private NamespaceType: { new(name: string, id: number, context: Context): Namespace };
	/** Next available numeric surrogate key for new namespaces. */
	private namespaceKeyNext = 0;
	/** List of namespaces indexed by a numeric surrogate key. */
	private namespaceList: Namespace[] = [];
	/** Table of namespaces by name in URI format (URL or URN).  */
	private namespaceNameTbl: { [name: string]: Namespace } = {};
}
