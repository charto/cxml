import { SimpleSchema } from '../schema/SimpleSchema';
import { ComplexType } from '../schema/ComplexType';
import { MemberSpec } from '../schema/Member';

export class Rule {

	addElement(member: RuleMember) {
		this.elements[member.id] = member;
	}

	addAttribute(member: RuleMember) {
		this.attributes[member.id] = member;
	}

	elements: { [id: number]: RuleMember } = {};
	attributes: { [id: number]: RuleMember } = {};

	static string = new Rule();

}

export class RuleMember {

	constructor(public rule: Rule, public spec: MemberSpec) {
		this.id = spec.detail!.token.id!;
		this.min = spec.min;
		this.max = spec.max;
	}

	id: number;
	min: number;
	max: number;

}

export class RuleSet {

	createRule(type: ComplexType) {
		const rule = new Rule();
		let childRule: Rule;

		if(type.elements && type.elements.group) {
			for(let childSpec of type.elements.group.list) {
				const detail = childSpec.detail;

				if(detail) {
					const token = detail.token;

					if(detail.type instanceof ComplexType) {
						childRule = this.createRule(detail.type);
					} else childRule = Rule.string;

					rule.addElement(new RuleMember(childRule, childSpec));
				}
			}
		}

		if(type.attributes) {
			for(let attributeSpec of type.attributes.list) {
				const detail = attributeSpec.detail;

				if(detail) {
					const token = detail.token;

					childRule = Rule.string;

					rule.addAttribute(new RuleMember(childRule, attributeSpec));
				}
			}
		}

		return(rule);
	}

	constructor(public schema: SimpleSchema) {
		this.rootRule = this.createRule(schema.document);
	}

	rootRule: Rule;

}
