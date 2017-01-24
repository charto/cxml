// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {MemberSpec} from './MemberSpec';
import {MemberRef, RawRefSpec} from './MemberRef';
import {Rule, RuleClass, Member} from './Type';
import {Item} from './Item';

/** Tuple: flags, parent type ID, child element list, attribute list.
  * Serialized JSON format. */
export type RawTypeSpec = [ number, number, RawRefSpec[], RawRefSpec[] ];

/** Parse name from schema in serialized JSON format.
  * If name used in XML is not a valid JavaScript identifier, the schema
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

/** Create a new data object inheriting default values from another. */

function inherit<Type>(parentObject: Type) {
	function Proxy() {}
	Proxy.prototype = parentObject;
	return(new (Proxy as any as { new(): Type })());
}

/** Represents the prototype of RuleClass.
  * Contains placeholders for any missing members. */

export interface RuleMembers {
	[name: string]: Member | Member[];
}

function defineSubstitute(substitute: MemberSpec, proxy: MemberRef) {
	var ref = new MemberRef([substitute, 0, substitute.safeName], substitute.namespace, proxy);

	return(ref);
}

/** Type specification defining attributes and children. */

export class TypeSpec extends Item {
	constructor(spec: RawTypeSpec, namespace: Namespace, name: string) {
		super(spec[1]);

		if(name) {
			var parts = parseName(name);
			this.name = parts.name;
			this.safeName = parts.safeName;
		}

		this.namespace = namespace;
		this.flags = spec[0];
		this.childSpecList = spec[2];
		this.attributeSpecList = spec[3];
	}

	getProto() { return(this.proto); }

	getType() { return(this.rule); }

	init() {
		// This function hasn't been called for this type yet by setParent,
		// but something must by now have called it for the parent type.

		var dependency = this.dependency as TypeSpec;
		let parent = Member;

		if(dependency && dependency != this) parent = dependency.proto;

		this.proto = class XmlType extends parent {};

		var instanceProto = this.proto.prototype as Member;
		instanceProto._exists = true;
		instanceProto._namespace = this.namespace.name;

		this.placeHolder = new this.proto();
		this.placeHolder._exists = false;
		this.rule = new Rule(this.proto);
		this.proto.rule = this.rule;
		this.rule.namespace = this.namespace;

		if(dependency) {
			this.rule.childTbl = inherit(dependency.rule.childTbl);
			this.rule.attributeTbl = inherit(dependency.rule.attributeTbl);
		} else {
			this.rule.attributeTbl = {};
			this.rule.childTbl = {};
		}

		this.rule.isPrimitive = !!(this.flags & TypeSpec.primitiveFlag);
		this.rule.isPlainPrimitive = !!(this.flags & TypeSpec.plainPrimitiveFlag);
		this.rule.isList = !!(this.flags & TypeSpec.listFlag);

		if(this.rule.isPrimitive) {
			var primitiveType: Item = this;
			var next: Item;

			while((next = primitiveType.dependency) && next != primitiveType) primitiveType = next;

			this.rule.primitiveType = (primitiveType as TypeSpec).safeName;
		}

		return(this.rule);
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
			var type = (this.proto.prototype) as RuleMembers;

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
			if(attributeRef.member.typeSpec) this.rule.addAttribute(attributeRef);
			this.defineMember(attributeRef);
		}
	}

	addSubstitutes(headRef: MemberRef, proxy: MemberRef) {
		headRef.member.containingTypeList.push({
			type: this,
			head: headRef,
			proxy: proxy
		});
		headRef.member.proxySpec.tryInit();

		for(var substitute of headRef.member.proxySpec.getSubstitutes()) {
			if(substitute == headRef.member) {
				this.rule.addChild(headRef);
			} else {
				var substituteRef = defineSubstitute(substitute, proxy);
				this.addChild(substituteRef, proxy);
			}
		}
	}

	addChild(memberRef: MemberRef, proxy?: MemberRef) {
		if(memberRef.member.proxySpec) this.addSubstitutes(memberRef, proxy || memberRef);
		else if(!memberRef.member.isAbstract) this.rule.addChild(memberRef);
	}

	addSubstitute(head: MemberSpec, substitute: MemberSpec) {
		if(this.ready && head.containingTypeList.length) {
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
				head = head.dependency as MemberSpec;
			}
		}

		this.substituteList.push(substitute);
	}

	/** Remove placeholders from instance prototype. They allow dereferencing
	  * contents of missing optional child elements without throwing errors.
	  * @param strict Also remove placeholders for mandatory child elements. */

	cleanPlaceholders(strict?: boolean) {
		var type = (this.proto.prototype) as RuleMembers;
		var nameList = this.optionalList;

		if(strict) nameList = nameList.concat(this.requiredList);

		for(var name of nameList) {
			delete(type[name]);
		}
	}

	private static addSubstituteToProxy(substitute: MemberSpec, type: RuleMembers, head?: MemberSpec) {
		if(substitute == head || !substitute.proxySpec) {
			if(!substitute.isAbstract) type[substitute.safeName] = substitute.typeSpec.placeHolder;
		} else {
			TypeSpec.addSubstitutesToProxy(substitute, type);
		}
	}

	private static addSubstitutesToProxy(member: MemberSpec, type: RuleMembers) {
		for(var substitute of member.proxySpec.getSubstitutes()) {
			TypeSpec.addSubstituteToProxy(substitute, type, member);
		}
	}

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

	private rule: Rule;
	private proto: RuleClass;
	private placeHolder: Member;

	/** Type contains text that gets parsed to JavaScript primitives. */
	static primitiveFlag = 1;
	/** Type only contains text, no wrapper object is needed to hold its attributes. */
	static plainPrimitiveFlag = 2;
	/** Type contains text with a list of whitespace-separated items. */
	static listFlag = 4;
}
