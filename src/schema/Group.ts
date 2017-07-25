import { SimpleElementSpec, ElementSpec } from './Element';

export const enum GroupKind {
	group,
	all,
	choice,
	sequence
}

export class Group {

	constructor( public kind: GroupKind ) {}

	addElement(spec: SimpleElementSpec | ElementSpec) {
		this.list.push(spec);
	}

	/** List of allowed elements and groups. */
	list: (SimpleElementSpec | ElementSpec)[] = []

}
