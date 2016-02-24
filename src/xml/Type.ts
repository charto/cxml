// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './Member';
import {MemberRef, RawRefSpec} from './MemberRef';
import {Item, ItemBase} from './Item';

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

export class TypeSpec implements Item<ItemBase<TypeSpec>> {
	constructor(spec: RawTypeSpec, namespace: Namespace, name: string) {
		this.item = new ItemBase(this as TypeSpec);

		if(name) {
			var parts = parseName(name);
			this.name = parts.name;
			this.safeName = parts.safeName;
		}

		this.namespace = namespace;
		this.flags = spec[0];
		this.item.parentNum = spec[1];
		this.childSpecList = spec[2];
		this.attributeSpecList = spec[3];
	}

	getProto() { return(this.proto); }

	getType() { return(this.type); }

	define() {
		// This function hasn't been called for this type yet by setParent,
		// but something must by now have called it for the parent type.

		var parent = (this.item.parent && this.item.parent != this) ? this.item.parent.proto : TypeInstance;

		this.proto = class XmlType extends parent {};

		var instanceProto = this.proto.prototype as TypeInstance;
		instanceProto._exists = true;
		instanceProto._namespace = this.namespace.name;

		this.placeHolder = new this.proto();
		this.placeHolder._exists = false;
		this.type = new Type(this.proto);
		this.proto.type = this.type;
		this.type.namespace = this.namespace;

		if(this.item.parent) {
			this.type.childTbl = inherit(this.item.parent.type.childTbl);
			this.type.attributeTbl = inherit(this.item.parent.type.attributeTbl);
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

			while((next = primitiveType.item.parent) && next != primitiveType) primitiveType = next;

			this.type.primitiveType = primitiveType.safeName;
		}
	}

	private defineMember(spec: RawRefSpec) {
		var ref = new MemberRef(spec, this.namespace);

		if(ref.member.typeSpec) {
			var memberType = ref.member.typeSpec.placeHolder;
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
			if(ref.member.typeSpec) this.type.addChild(ref);
		}

		for(spec of this.attributeSpecList) {
			var ref = this.defineMember(spec);
			if(ref.member.typeSpec) this.type.addAttribute(ref);
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

	item: ItemBase<TypeSpec>;

	namespace: Namespace;
	name: string;
	safeName: string;
	flags: number;

	childSpecList: RawRefSpec[];
	attributeSpecList: RawRefSpec[];

	optionalList: string[] = [];
	requiredList: string[] = [];

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
		this.attributeTbl[ref.member.namespace.getPrefix() + ref.member.name] = ref;
	}

	addChild(ref: MemberRef) {
		this.childTbl[ref.member.namespace.getPrefix() + ref.member.name] = ref;
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
