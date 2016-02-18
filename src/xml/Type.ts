// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Member, MemberSpec} from './Member';

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
	constructor(
		namespace: Namespace,
		name: string,
		flags: number,
		parentNum: number,
		childSpecList: MemberSpec[],
		attributeSpecList: MemberSpec[]
	) {
		if(name) {
			var parts = parseName(name);
			this.name = parts.name;
			this.safeName = parts.safeName;
		}

		this.namespace = namespace;
		this.flags = flags;
		this.parentNum = parentNum;
		this.childSpecList = childSpecList;
		this.attributeSpecList = attributeSpecList;
	}

	setParent(spec: TypeSpec) {
		this.parent = spec;

		if(spec.proto) {
			// Entire namespace for parent type is already fully defined,
			// so the parent type's dependentList won't get processed any more
			// and we should process this type immediately.

			this.defineType();
		} else if(spec != this) spec.dependentList.push(this);
	}

	getProto() { return(this.proto); }

	getType() { return(this.type); }

	defineType() {
		if(!this.proto) {
			// This function hasn't been called for this type yet by setParent,
			// but something must by now have called it for the parent type.

			var parent = (this.parent && this.parent != this) ? this.parent.proto : TypeInstance;

			this.proto = class XmlType extends parent {};
			(this.proto.prototype as TypeInstance)._exists = true;
			this.placeHolder = new this.proto();
			this.placeHolder._exists = false;
			this.type = new Type(this.proto);
			this.proto.type = this.type;

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

	private defineMember(spec: MemberSpec) {
		var member = new Member(spec, this.namespace);

		if(member.typeSpec) {
			var memberType = member.typeSpec.placeHolder;
			var type = (this.proto.prototype) as TypeClassMembers;

			type[member.safeName] = (member.max > 1) ? [memberType] : memberType;

			if(member.min < 1) this.optionalList.push(member.safeName);
			else this.requiredList.push(member.safeName);
		}

		return(member);
	}

	defineMembers() {
		var spec: MemberSpec;

		for(spec of this.childSpecList) {
			var member = this.defineMember(spec);
			if(member.typeSpec) this.type.addChild(member);
		}

		for(spec of this.attributeSpecList) {
			var member = this.defineMember(spec);
			if(member.typeSpec) this.type.addAttribute(member);
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
	childSpecList: MemberSpec[];
	attributeSpecList: MemberSpec[];

	optionalList: string[] = [];
	requiredList: string[] = [];

	// Track dependents for Kahn's topological sort algorithm.
	dependentList: TypeSpec[] = [];

	private type: Type;
	private proto: TypeClass;
	private placeHolder: TypeInstance;

	static primitiveFlag = 1;
	static plainPrimitiveFlag = 2;
	static listFlag = 4;
}

export interface TypeClass {
	new(): TypeInstance;

	type?: Type;
}

export interface HandlerInstance {
	[key: string]: any;

	content?: any;
	_exists: boolean;

	_before?(): void;
	_after?(): void;
}

export interface HandlerClass extends TypeClass {
	new(): HandlerInstance;

	_custom?: boolean;
}

export interface TypeClassMembers {
	[name: string]: TypeInstance | TypeInstance[];
}

export class TypeInstance {
	/** Name of the type, pointing to the name of the constructor function.
	  * Might contain garbage... */
	// static name: string;
	// static type: Type;
	_exists: boolean;
}

/** Parser rule, defines a handler class, valid attributes and children
  * for an XSD tag. */

export class Type {
	constructor(handler: TypeClass) {
		this.handler = handler;
	}

	addAttribute(member: Member) {
		this.attributeTbl[member.namespace.getPrefix() + member.name] = member;
	}

	addChild(member: Member) {
		this.childTbl[member.namespace.getPrefix() + member.name] = member;
	}

	/** Constructor function for creating objects handling and representing the results of this parsing rule. */
	handler: HandlerClass;

	/** Table of allowed attributes. */
	attributeTbl: { [key: string]: Member } = {};

	/** Table mapping the names of allowed child tags, to their parsing rules. */
	childTbl: { [key: string]: Member };

	isPrimitive: boolean;
	isPlainPrimitive: boolean;
	isList: boolean;

	primitiveType: string;
}
