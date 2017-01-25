// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {NamespaceBase} from './NamespaceBase';

/** XML parser context, holding definitions of all imported namespaces. */

export class ContextBase<Namespace extends NamespaceBase<any>> {
	constructor(NamespaceType: { new(name: string, id: number, context: ContextBase<Namespace>): Namespace }) {
		this.NamespaceType = NamespaceType;
	}

	/** Look up namespace by name. */
	namespaceByName(name: string) { return(this.namespaceNameTbl[name]); }

	/** Look up namespace by internal numeric surrogate key. */
	namespaceById(id: number) { return(this.namespaceList[id]); }

	/** Create or look up a namespace by name in URI (URL or URN) format. */

	registerNamespace(name: string) {
		name = NamespaceBase.sanitize(name);
		var namespace = this.namespaceByName(name);

		if(!namespace) {
			// Create a new namespace.

			var id = this.namespaceKeyNext++;
			namespace = new this.NamespaceType(name, id, this);

			this.namespaceNameTbl[name] = namespace;
			this.namespaceList[id] = namespace;
		}

		return(namespace);
	}

	/** Copy a namespace from another context. */

	copyNamespace(other: NamespaceBase<any>) {
		let namespace = this.namespaceList[other.id];

		if(namespace) {
			if(namespace.name != other.name) throw(new Error('Duplicate namespace ID'));
			return(namespace);
		}

		if(this.namespaceByName(other.name)) throw(new Error('Duplicate namespace name'));

		namespace = new this.NamespaceType(other.name, other.id, this);
		namespace.initFrom(other);

		this.namespaceNameTbl[other.name] = namespace;
		this.namespaceList[other.id] = namespace;

		if(this.namespaceKeyNext <= other.id) this.namespaceKeyNext = other.id + 1;

		return(namespace);
	}

	/** Constructor for namespaces in this context. */
	private NamespaceType: { new(name: string, id: number, context: ContextBase<Namespace>): Namespace };

	/** Next available numeric surrogate key for new namespaces. */
	private namespaceKeyNext = 0;
	/** List of namespaces indexed by a numeric surrogate key. */
	protected namespaceList: Namespace[] = [];
	/** Table of namespaces by name in URI format (URL or URN).  */
	private namespaceNameTbl: { [name: string]: Namespace } = {};
}
