import { AttributeSpec } from './Attribute';
import { AttributeGroup } from './AttributeGroup';
import { SimpleElementSpec, Element, ElementSpec } from './Element';
import { Group, GroupKind } from './Group';

/** Definition of a type containing other elements and attributes. Only applicable to elements. */

export class ComplexType {

	addAttribute(spec: AttributeSpec) {
		if(!this.attributes) this.attributes = new AttributeGroup();
		this.attributes.addAttribute(spec);
	}

	addAll(spec: SimpleElementSpec | ElementSpec) {
		if(!this.elements) {
			this.elements = new ElementSpec();
			this.elements.group = new Group(GroupKind.all);
		}

		this.elements.group!.addElement(spec);
	}

	parent?: ComplexType;

	proto: Element;

	attributes?: AttributeGroup;

	elements?: ElementSpec;

}
