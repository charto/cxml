// This is schema stuff unrelated to the parser for now.

import { Namespace } from '../Namespace';
import { Member, MemberKind } from './Member';

export class Attribute extends Member {

	constructor(name: string, ns?: Namespace) {
		super(name, ns);
	}

	kind: MemberKind.attribute;

}

Attribute.prototype.kind = MemberKind.attribute;
