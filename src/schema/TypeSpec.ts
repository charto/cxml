const enum Flags {
	isProxy = 1
}

export class TypeSpec {

	get isProxy() { return(!!(this.flags & Flags.isProxy)); }

	set isProxy(value: boolean) { this.setFlag(value, Flags.isProxy); }

	private setFlag(value: boolean, flag: Flags) {
		if(value) this.flags |= flag;
		else this.flags &= ~flag;
	}

	private flags = 0;

}
