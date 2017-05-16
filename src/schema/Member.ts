// This is schema stuff unrelated to the parser for now.

import { Namespace } from '../Namespace';

export const enum MemberKind {
	element,
	attribute
}

export class Member {

	/** @param name Element or attribute name. Not unique within a namespace!
	  * Schema may define duplicates with different types when nested.
	  * @param ns Namespace for the element or attribute. */
	constructor(public name: string, public ns?: Namespace) {}

	/** Distinguish between element and attribute (defined in the prototype). */
	kind: MemberKind;

}
