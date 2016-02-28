// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './Member';
import {MemberRef, RawRefSpec} from './MemberRef';
import {Type, TypeClass, TypeInstance} from './Type';
import {Item, ItemBase} from './Item';

/** Tuple: flags, parent type ID, child element list, attribute list */
export type RawTypeSpec = [ number, number, RawRefSpec[], RawRefSpec[] ];

/** If name used in XML is not a valid JavaScript identifier, the schema
  * definition will be in format <cleaned up name for JavaScript>:<XML name>. */

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

/** Represents the prototype of TypeClass. */

export interface TypeClassMembers {
	[name: string]: TypeInstance | TypeInstance[];
}

function defineSubstitute(substitute: MemberSpec, proxy: MemberRef) {
	var ref = new MemberRef([substitute, 0, substitute.safeName], substitute.namespace, proxy);

	return(ref);
}

/** Type specification defining attributes and children. */

export class TypeSpec implements Item<ItemBase<TypeSpec>> {
	constructor(spec: RawTypeSpec, namespace: Namespace, name: string) {
		// Initialize helper containing data and methods also applicable to members.

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

	private defineMember(ref: MemberRef) {
		var typeSpec = ref.member.typeSpec;
		var proxySpec = ref.member.proxySpec;

		if(proxySpec) {
			if(ref.max > 1) {
				typeSpec = proxySpec;
			} else {
				proxySpec = this;
				typeSpec = null;
			}

			TypeSpec.addSubstitutesToProxy(ref.member, proxySpec.proto.prototype);
		}

		if(typeSpec) {
			var memberType = typeSpec.placeHolder;
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
			var memberRef = new MemberRef(spec, this.namespace);
			this.addChild(memberRef);
			this.defineMember(memberRef);
		}

		for(spec of this.attributeSpecList) {
			var attributeRef = new MemberRef(spec, this.namespace);
			if(attributeRef.member.typeSpec) this.type.addAttribute(attributeRef);
			this.defineMember(attributeRef);
		}
	}

	addSubstitutes(headRef: MemberRef, proxy: MemberRef) {
		headRef.member.containingTypeList.push({
			type: this,
			head: headRef,
			proxy: proxy
		});
		headRef.member.proxySpec.item.define();

		for(var substitute of headRef.member.proxySpec.getSubstitutes()) {
			if(substitute == headRef.member) {
				this.type.addChild(headRef);
			} else {
				var substituteRef = defineSubstitute(substitute, proxy);
				this.addChild(substituteRef, proxy);
			}
		}
	}

	addChild(memberRef: MemberRef, proxy?: MemberRef) {
		if(memberRef.member.proxySpec) this.addSubstitutes(memberRef, proxy || memberRef);
		else if(!memberRef.member.isAbstract) this.type.addChild(memberRef);
	}

	addSubstitute(head: MemberSpec, substitute: MemberSpec) {
		if(this.item.defined && head.containingTypeList.length) {
			// The element's proxy type has already been defined
			// so we need to patch other types containing the element.

			for(var spec of head.containingTypeList) {
				var ref = defineSubstitute(substitute, spec.proxy);
				spec.type.addChild(ref, spec.proxy);

				if(spec.head.max <= 1) {
					TypeSpec.addSubstituteToProxy(substitute, spec.type.proto.prototype);
				}
			}

			// Add the substitution to proxy type of the group head,
			// and loop if the head further substitutes something else.

			while(head) {
				TypeSpec.addSubstituteToProxy(substitute, head.proxySpec.proto.prototype);
				head = head.item.parent;
			}
		}

		this.substituteList.push(substitute);
	}

	/** Remove placeholders from instance prototype. They allow dereferencing
	  * contents of missing optional child elements without throwing errors.
	  * @param strict Also remove placeholders for mandatory child elements. */

	cleanPlaceholders(strict?: boolean) {
		var type = (this.proto.prototype) as TypeClassMembers;
		var nameList = this.optionalList;

		if(strict) nameList = nameList.concat(this.requiredList);

		for(var name of nameList) {
			delete(type[name]);
		}
	}

	private static addSubstituteToProxy(substitute: MemberSpec, type: TypeClassMembers, head?: MemberSpec) {
		if(substitute == head || !substitute.proxySpec) {
			if(!substitute.isAbstract) type[substitute.safeName] = substitute.typeSpec.placeHolder;
		} else {
			TypeSpec.addSubstitutesToProxy(substitute, type);
		}
	}

	private static addSubstitutesToProxy(member: MemberSpec, type: TypeClassMembers) {
		for(var substitute of member.proxySpec.getSubstitutes()) {
			TypeSpec.addSubstituteToProxy(substitute, type, member);
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

	/** Type contains text that gets parsed to JavaScript primitives. */
	static primitiveFlag = 1;
	/** Type only contains text, no wrapper object is needed to hold its attributes. */
	static plainPrimitiveFlag = 2;
	/** Type contains text with a list of whitespace-separated items. */
	static listFlag = 4;
}
