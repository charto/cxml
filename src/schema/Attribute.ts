import { AttributeGroup } from './AttributeGroup';
import { MemberSpec, MemberMeta, SimpleType, SimpleValue } from './Member';

/** Configuration for attributes as type members. */

export class AttributeSpec extends MemberSpec {

	/** Default value to use if the element or attribute is missing. */
	default?: SimpleValue;
	/** Name and other info. */
	meta?: AttributeMeta;

	group?: AttributeGroup;

}

export class AttributeMeta extends MemberMeta {

	type: SimpleType;

}
