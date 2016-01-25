import { Namespace as NamespaceBase } from '../Namespace';

const enum Flags {
	isAbstract = 1,
	isSubstituted = 2,
	isAny = 4,
	isExported = 8
}

/** Base class for element and attribution specifications from schema. */

export class MemberSpec<Namespace extends NamespaceBase = NamespaceBase> {

	get isAbstract() { return(!!(this.flags & Flags.isAbstract)); }
	get isSubstituted() { return(!!(this.flags & Flags.isSubstituted)); }
	get isAny() { return(!!(this.flags & Flags.isAny)); }
	get isExported() { return(!!(this.flags & Flags.isExported)); }

	set isAbstract(value: boolean) { this.setFlag(value, Flags.isAbstract); }
	set isSubstituted(value: boolean) { this.setFlag(value, Flags.isSubstituted); }
	set isAny(value: boolean) { this.setFlag(value, Flags.isAny); }
	set isExported(value: boolean) { this.setFlag(value, Flags.isExported); }

	private setFlag(value: boolean, flag: Flags) {
		if(value) this.flags |= flag;
		else this.flags &= ~flag;
	}

	ns: Namespace;
	/** Name as it appears in input XML. */
	name: string;
	/** Name allowed with JavaScript dot property access notation. */
	safeName: string;

	private flags = 0;

}
