import { AttributeSpec } from './Attribute';
import { AttributeGroup } from './AttributeGroup';
import { SimpleElementSpec, Element, ElementSpec, ElementBase } from './Element';
import { Group, GroupKind } from './Group';

export interface ElementTypeConstructor<ElementClass extends ElementBase = ElementBase> {
	new(): ElementClass;
};

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

	createProto<ElementClass = ElementBase>() {
		if(!this.XMLType) {
			const BaseType = this.base ? this.base.createProto() : ElementBase;
			this.XMLType = class XMLType extends BaseType {};
		}

		return(this.XMLType as ElementTypeConstructor<ElementClass>);
	}

	base?: ComplexType;

	XMLType: ElementTypeConstructor;

	attributes?: AttributeGroup;
	elements?: ElementSpec;

}
