// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec, MemberRef, RawRefSpec} from './Member';

/** Tuple: flags, parent type ID, child element list, attribute list */
export type RawTypeSpec = [ number, number, RawRefSpec[], RawRefSpec[] ];

export function parseName(name: string) {
	var splitPos = name.indexOf(':');
	var safeName: string

	if(splitPos >= 0) {
		safeName = name.substr(0, splitPos);
		name = name.substr(splitPos + 1);
	} else safeName = name;

	return({
		name: name,
		safeName: safeName
	});
}

function inherit<Type>(parentObject: Type) {
	function Proxy() {}
	Proxy.prototype = parentObject;
	return(new (Proxy as any as { new(): Type })());
}

/** Type specification defining attributes and children. */

export class TypeSpec {
	constructor(spec: RawTypeSpec, namespace: Namespace, name: string) {
		if(name) {
			var parts = parseName(name);
			this.name = parts.name;
			this.safeName = parts.safeName;
		}

		this.namespace = namespace;
		this.flags = spec[0];
		this.parentNum = spec[1];
		this.childSpecList = spec[2];
		this.attributeSpecList = spec[3];
	}

	setParent(spec: TypeSpec) {
		this.parent = spec;

		if(spec.defined) {
			// Entire namespace for parent type is already fully defined,
			// so the parent type's dependentList won't get processed any more
			// and we should process this type immediately.

			this.defineType();
		} else if(spec != this) spec.dependentList.push(this);
	}

	getProto() { return(this.proto); }

	getType() { return(this.type); }

	defineType() {
		if(!this.defined) {
			this.defined = true;

			// This function hasn't been called for this type yet by setParent,
			// but something must by now have called it for the parent type.

			var parent = (this.parent && this.parent != this) ? this.parent.proto : TypeInstance;

			this.proto = class XmlType extends parent {};

			var instanceProto = this.proto.prototype as TypeInstance;
			instanceProto._exists = true;
			instanceProto._namespace = this.namespace.name;

			this.placeHolder = new this.proto();
			this.placeHolder._exists = false;
			this.type = new Type(this.proto);
			this.proto.type = this.type;
			this.type.namespace = this.namespace;

			if(this.parent) {
				this.type.childTbl = inherit(this.parent.type.childTbl);
				this.type.attributeTbl = inherit(this.parent.type.attributeTbl);
			} else {
				this.type.attributeTbl = {};
				this.type.childTbl = {};
			}

			this.type.isPrimitive = !!(this.flags & TypeSpec.primitiveFlag);
			this.type.isPlainPrimitive = !!(this.flags & TypeSpec.plainPrimitiveFlag);
			this.type.isList = !!(this.flags & TypeSpec.listFlag);

			if(this.type.isPrimitive) {
				var primitiveType: TypeSpec = this;
				var next: TypeSpec;

				while((next = primitiveType.parent) && next != primitiveType) primitiveType = next;

				this.type.primitiveType = primitiveType.safeName;
			}
		}

		for(var dependent of this.dependentList) {
			dependent.defineType();
		}

		this.dependentList = [];
	}

	private defineMember(spec: RawRefSpec) {
		var ref = new MemberRef(spec, this.namespace);

		if(ref.spec.typeSpec) {
			var memberType = ref.spec.typeSpec.placeHolder;
			var type = (this.proto.prototype) as TypeClassMembers;

			type[ref.safeName] = (ref.max > 1) ? [memberType] : memberType;

			if(ref.min < 1) this.optionalList.push(ref.safeName);
			else this.requiredList.push(ref.safeName);
		}

		return(ref);
	}

	defineMembers() {
		var spec: RawRefSpec;

		for(spec of this.childSpecList) {
			var ref = this.defineMember(spec);
			if(ref.spec.typeSpec) this.type.addChild(ref);
		}

		for(spec of this.attributeSpecList) {
			var ref = this.defineMember(spec);
			if(ref.spec.typeSpec) this.type.addAttribute(ref);
		}
	}

	cleanPlaceholders(strict?: boolean) {
		var type = (this.proto.prototype) as TypeClassMembers;
		var nameList = this.optionalList;

		if(strict) nameList = nameList.concat(this.requiredList);

		for(var name of nameList) {
			delete(type[name]);
		}
	}

	namespace: Namespace;
	name: string;
	safeName: string;
	flags: number;

	parentNum: number;
	parent: TypeSpec;
	childSpecList: RawRefSpec[];
	attributeSpecList: RawRefSpec[];

	optionalList: string[] = [];
	requiredList: string[] = [];

	// Track dependents for Kahn's topological sort algorithm.
	dependentList: TypeSpec[] = [];

	defined: boolean;

	private type: Type;
	private proto: TypeClass;
	private placeHolder: TypeInstance;

	static primitiveFlag = 1;
	static plainPrimitiveFlag = 2;
	static listFlag = 4;
}

/** Interface implemented by schema type classes, allowing custom hooks. */

export interface HandlerInstance {
	[key: string]: any;

	content?: any;
	_exists: boolean;
	_namespace: string;

	_before?(): void;
	_after?(): void;
}

/** Base class inherited by all schema type classes, not defining custom hooks. */

export class TypeInstance implements HandlerInstance {
	/** Name of the type, pointing to the name of the constructor function.
	  * Might contain garbage... */
	// static name: string;
	// static type: Type;
	_exists: boolean;
	_namespace: string;
}

/** Class type compatible with schema type classes. */

export interface TypeClass {
	new(): TypeInstance;

	type?: Type;
}

/** Class type compatible with schema type classes, allowing custom hooks. */

export interface HandlerClass extends TypeClass {
	new(): HandlerInstance;

	_custom?: boolean;
}

export interface TypeClassMembers {
	[name: string]: TypeInstance | TypeInstance[];
}

/** Parser rule, defines a handler class, valid attributes and children
  * for an XSD tag. */

export class Type {
	constructor(handler: TypeClass) {
		this.handler = handler;
	}

	addAttribute(ref: MemberRef) {
		this.attributeTbl[ref.namespace.getPrefix() + ref.spec.name] = ref;
	}

	addChild(ref: MemberRef) {
		this.childTbl[ref.namespace.getPrefix() + ref.spec.name] = ref;
	}

	namespace: Namespace;

	/** Constructor function for creating objects handling and representing the results of this parsing rule. */
	handler: HandlerClass;

	/** Table of allowed attributes. */
	attributeTbl: { [key: string]: MemberRef } = {};

	/** Table mapping the names of allowed child tags, to their parsing rules. */
	childTbl: { [key: string]: MemberRef };

	isPrimitive: boolean;
	isPlainPrimitive: boolean;
	isList: boolean;

	primitiveType: string;
}
