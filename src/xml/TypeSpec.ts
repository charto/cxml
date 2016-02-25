// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './Member';
import {MemberRef, RawRefSpec} from './MemberRef';
import {Type, TypeClass, TypeInstance} from './Type';
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

export interface TypeClassMembers {
	[name: string]: TypeInstance | TypeInstance[];
}

function defineSubstitute(head: MemberSpec, substitute: MemberSpec) {
	var ref = new MemberRef([substitute, 0, substitute.safeName], substitute.namespace);

	// console.log('\t' + substitute.namespace.getPrefix() + substitute.name);

	return(ref);
}

function addSubstitutesToType(headRef: MemberRef, type: Type) {
	headRef.member.containingTypeList.push(type);

	// console.log('DEFINE ' + headRef.member.namespace.getPrefix() + headRef.member.name);
	headRef.member.proxySpec.item.define();

	for(var substitute of headRef.member.proxySpec.getSubstitutes()) {
		if(substitute == headRef.member) {
			type.addChild(headRef);
		} else {
			var substituteRef = defineSubstitute(headRef.member, substitute);
			addChildToType(substituteRef, type);
		}
	}
}

function addChildToType(memberRef: MemberRef, type: Type) {
	if(memberRef.member.typeSpec) {
		if(memberRef.member.isSubstituted) {
			addSubstitutesToType(memberRef, type);
		} else if(!memberRef.member.isAbstract) type.addChild(memberRef);
	}
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

		return(this.type);
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

	getSubstitutes() {
		return(this.substituteList);
	}

	defineMembers() {
		var spec: RawRefSpec;

		for(spec of this.childSpecList) {
			var memberRef = this.defineMember(spec);
			addChildToType(memberRef, this.type);
		}

		for(spec of this.attributeSpecList) {
			var attributeRef = this.defineMember(spec);
			if(attributeRef.member.typeSpec) this.type.addAttribute(attributeRef);
		}
	}

	addSubstitute(head: MemberSpec, substitute: MemberSpec) {
		if(this.item.defined && head.containingTypeList.length) {
			// The element's proxy type has already been defined
			// so we need to patch other types containing the element.

			// console.log('ADD ' + this.safeName + ':' + this.name + ' ' + substitute.namespace.getPrefix() + substitute.name + ' ' + (this.item.defined || ''));

			var ref = defineSubstitute(head, substitute);

			for(var type of head.containingTypeList) {
				// console.log('\t' + Object.keys(type.childTbl).slice(0, 3).join(', '));

				addChildToType(ref, type);
			}
		}

		this.substituteList.push(substitute);
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
	// TODO: Is a separate name and safeName needed for anything here?
	// Maybe for future use when cxsd can import parsed namespaces?
	name: string;
	safeName: string;
	flags: number;

	childSpecList: RawRefSpec[];
	attributeSpecList: RawRefSpec[];
	substituteList: MemberSpec[];

	optionalList: string[] = [];
	requiredList: string[] = [];

	private type: Type;
	private proto: TypeClass;
	private placeHolder: TypeInstance;

	static primitiveFlag = 1;
	static plainPrimitiveFlag = 2;
	static listFlag = 4;
}
