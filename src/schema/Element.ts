import { ElementToken } from '../parser/Token';

import { ComplexType } from './ComplexType';
import { Group } from './Group';
import { MemberSpec, MemberDetail, SimpleType, SimpleValue } from './Member';

export class SimpleElementSpec extends MemberSpec {

	/** Name and other info. */
	detail: SimpleElementDetail;

}

/** Configuration for elements as type members. */

export class ElementSpec extends MemberSpec {

	/** Name and other info, also available in the prototype of all element instances. */
	detail?: ElementDetail;

	group?: Group;

}

/** Metadata for elements without children or attributes in builder output. */

export class SimpleElementDetail extends MemberDetail {

	/** Substitution group head. */
	substitutes?: SimpleElementDetail;

	/** Token with element name and namespace.
	  * A single token may have different types depending on its parent. */
	token: ElementToken;

	type: SimpleType;

}

/** Metadata for elements in builder output. */

export class ElementDetail<ElementClass extends Element = Element> extends MemberDetail {

	/** A singleton object to use if the element is missing. */
	placeholder: ElementClass;

	/** Substitution group head. */
	substitutes?: ElementDetail;

	/** Token with element name and namespace.
	  * A single token may have different types depending on its parent. */
	token: ElementToken;

	type: ComplexType;

}

/** Base class for elements defined in the schema. Inherited by a hierarchy of types,
 *  each branch terminating in an element definition. */

export class ElementBase {

	// @hidden
	// _: MemberDetail;

}

/** Represents any element defined in the schema. */

export interface Element extends ElementBase {

	/** Builder metadata. Defined in the prototypes of parsed objects,
	  * or properties of placeholders for non-existent members. */
	_: ElementDetail<this>;

	/** Possible text content. */
	$?: SimpleValue;

}
