// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {NamespaceBase} from './NamespaceBase';
import {Type, TypeSpec, TypeClassMembers} from './Type';
import {Context} from './Context';

export interface ModuleExports {
	[name: string]: any;
	_cxml: [ Namespace ];
}

/** Tuple: module exports object, list of imported type names */
export type ImportSpec = [ ModuleExports, string[] ];

export class Namespace extends NamespaceBase<Context, Namespace> {
	init(importSpecList: ImportSpec[]) {
		this.importSpecList = importSpecList;

		// Skip the document type.
		var importOffset = 1;

		for(var importSpec of importSpecList) {
			importOffset += importSpec[1].length;
		}

		this.typeSpecList.length = importOffset;
		return(this);
	}

	addType(spec: TypeSpec) {
		if(this.doc) this.typeSpecList.push(spec);
		else {
			// First type added after imports is number 0, the document type.
			this.doc = spec;
		}

		if(spec.safeName) this.exportTypeTbl[spec.safeName] = spec;
	}

	typeByNum(num: number) {
		return(this.typeSpecList[num]);
	}

	link() {
		// Skip the document type.
		var typeNum = 1;

		for(var importSpec of this.importSpecList) {
			var other = importSpec[0]._cxml[0];

			this.importNamespaceList.push(other);

			for(var typeName of importSpec[1]) {
				this.typeSpecList[typeNum++] = other.exportTypeTbl[typeName];
			}
		}

		this.exportOffset = typeNum;

		var typeSpecList = this.typeSpecList;
		var typeCount = typeSpecList.length;

		while(typeNum < typeCount) {
			var typeSpec = typeSpecList[typeNum++];

			if(typeSpec.parentNum) {
				typeSpec.setParent(typeSpecList[typeSpec.parentNum]);
			}
		}
	}

	exportTypes(exports: ModuleExports) {
		var typeSpecList = this.typeSpecList;
		var typeCount = typeSpecList.length;

		for(var typeNum = this.exportOffset; typeNum < typeCount; ++typeNum) {
			var typeSpec = typeSpecList[typeNum];

			exports[typeSpec.safeName] = typeSpec.getProto();
		}
	}

	exportDocument(exports: ModuleExports) {
		exports['document'] = this.doc.getProto().prototype;
	}

	/** Get an internally used arbitrary prefix for fully qualified names
	  * in this namespace. */

	getPrefix() { return(this.id + ':'); }

	doc: TypeSpec;

	importSpecList: ImportSpec[];
	importNamespaceList: Namespace[] = [];
	exportTypeNameList: string[];
	typeSpecList: TypeSpec[] = [];
	exportOffset: number;

	exportTypeTbl: { [name: string]: TypeSpec } = {};
}
