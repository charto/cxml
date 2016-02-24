// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {ContextBase} from './ContextBase';
import {Namespace, ModuleExports} from './Namespace';
import {TypeSpec, RawTypeSpec} from './TypeSpec';
import {MemberSpec, RawMemberSpec} from './Member';
import {Item, ItemBase} from '../xml/Item';

/** Create types and members based on JSON specifications. */

function defineSpecs<Spec extends Item<ItemBase<any>>>(pendingList: Spec[]) {
	for(var spec of pendingList) {
		// If the spec has a parent, it handles defining the child.
		if(!spec.item.parent || spec.item.parent == spec) {
			spec.item.define();
		}
	}
}

/** XML parser context, holding definitions of all imported namespaces. */

export class Context extends ContextBase<Context, Namespace> {
	constructor() {
		super(Namespace);
	}

	/** Mark a namespace as seen and add it to list of pending namespaces. */

	markNamespace(exportObj: ModuleExports) {
		this.pendingNamespaceList.push(exportObj);
		++this.pendingNamespaceCount;
	}

	registerTypes(
		namespace: Namespace,
		exportTypeNameList: string[],
		rawTypeSpecList: RawTypeSpec[]
	) {
		var exportTypeCount = exportTypeNameList.length;
		var typeCount = rawTypeSpecList.length;
		var typeName: string;

		for(var typeNum = 0; typeNum < typeCount; ++typeNum) {
			var rawSpec = rawTypeSpecList[typeNum];

			if(typeNum > 0 && typeNum <= exportTypeCount) {
				typeName = exportTypeNameList[typeNum - 1];
			} else typeName = null;

			var typeSpec = new TypeSpec(rawSpec, namespace, typeName);

			namespace.addType(typeSpec);
			this.pendingTypeList.push(typeSpec);
			this.typeList.push(typeSpec);
		}
	}

	registerMembers(
		namespace: Namespace,
		rawMemberSpecList: RawMemberSpec[]
	) {
		for(var rawSpec of rawMemberSpecList) {
			var memberSpec = new MemberSpec(rawSpec, namespace);

			namespace.addMember(memberSpec);
			this.pendingMemberList.push(memberSpec);
		}
	}

	/** Process namespaces seen so far. */

	process() {
		// Start only when process has been called for all namespaces.

		if(--this.pendingNamespaceCount > 0) return;

		// Link types to their parents.

		for(var exportObj of this.pendingNamespaceList) {
			var namespace = exportObj._cxml[0];
			namespace.link();
		}

		// Create classes for all types.
		// This is effectively Kahn's algorithm for topological sort
		// (the rest is in the TypeSpec class).

		defineSpecs(this.pendingTypeList);
		defineSpecs(this.pendingMemberList);

		for(var typeSpec of this.pendingTypeList) {
			typeSpec.defineMembers();
		}

		this.pendingTypeList = [];
		this.pendingMemberList = [];

		for(var exportObject of this.pendingNamespaceList) {
			var namespace = exportObject._cxml[0];

			namespace.exportTypes(exportObject);
			namespace.exportDocument(exportObject);
		}

		this.pendingNamespaceList = [];
	}

	/** Remove temporary structures needed to define new handlers. */

	cleanPlaceholders(strict?: boolean) {
		for(var namespace of this.namespaceList) {
			namespace.importSpecList = null;
			namespace.exportTypeNameList = null;
			namespace.typeSpecList = null;
			namespace.memberSpecList = null;
			namespace.exportTypeTbl = null;
			namespace.exportMemberTbl = null;
		}

		for(var typeSpec of this.typeList) {
			typeSpec.cleanPlaceholders(strict);
		}

		this.typeList = null;
	}

	/** List of pending namespaces (not yet registered or waiting for processing). */
	private pendingNamespaceList: ModuleExports[] = [];
	/** Grows with pendingNamespaceList and shrinks when namespaces are registered.
	  * When zero, all pending namespaces have been registered and can be processed. */
	private pendingNamespaceCount = 0;

	private pendingTypeList: TypeSpec[] = [];
	private pendingMemberList: MemberSpec[] = [];

	private typeList: TypeSpec[] = [];
}
