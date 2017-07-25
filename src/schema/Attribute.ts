import { AttributeGroup } from './AttributeGroup';
import { MemberSpec, MemberDetail, SimpleType, SimpleValue } from './Member';

/** Configuration for attributes as type members. */

export class AttributeSpec extends MemberSpec {

	/** Default value to use if the element or attribute is missing. */
	default?: SimpleValue;
	/** Name and other info. */
	detail?: AttributeDetail;

	group?: AttributeGroup;

}

export class AttributeDetail extends MemberDetail {

	type: SimpleType;

}
