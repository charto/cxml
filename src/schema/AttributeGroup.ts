import { AttributeSpec } from './Attribute';

export class AttributeGroup {

	addAttribute(spec: AttributeSpec) {
		this.list.push(spec);
	}

	/** List of allowed attributes and attribute groups. */
	list: AttributeSpec[] = []

}
