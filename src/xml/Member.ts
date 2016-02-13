// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {Namespace} from './Namespace';
import {Type, TypeSpec, parseName} from './Type';

/** Tuple: name, flags, type ID list */
export type MemberSpec = [ string, number, number[], number ];

export class Member {
	constructor(spec: MemberSpec, namespace: Namespace) {
		var parts = parseName(spec[0]);
		var flags = spec[1];
		var typeNumList = spec[2];
		var namespaceNum = spec[3];

		if(typeNumList.length == 1) {
			this.name = parts.name;
			if(namespaceNum || namespaceNum === 0) {
				// The member is not in the same namespace as its parent type.
				this.namespace = namespace.importNamespaceList[namespaceNum];
			} else this.namespace = namespace;
			this.safeName = parts.safeName;
			this.typeSpec = namespace.typeByNum(typeNumList[0]);
			this.type = this.typeSpec.getType();

			this.min = (flags & TypeSpec.optionalFlag) ? 0 : 1;
			this.max = (flags & TypeSpec.arrayFlag) ? Infinity : 1;

			// if(this.namespace != namespace) console.log(namespace.name + ':' + this.typeSpec.name + ':' + this.name + '\t' + this.namespace.name);
		} else {
			// TODO: What now? Make sure this is not reached.
			// Different types shouldn't be joined with | in .d.ts, instead
			// they should be converted to { TypeA: TypeA, TypeB: TypeB... }

			console.log(spec);
		}
	}

	name: string;
	namespace: Namespace;
	safeName: string;

	min: number;
	max: number;

	typeSpec: TypeSpec;
	type: Type;
}
