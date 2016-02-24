// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {NamespaceBase} from './NamespaceBase';
import {TypeSpec} from './Type';
import {MemberSpec} from './Member';
import {Context} from './Context';

export interface ModuleExports {
	[name: string]: any;
	_cxml: [ Namespace ];
}

/** Tuple: module exports object, list of imported type names */
export type ImportSpec = [ ModuleExports, string[], string[] ];

export class Namespace extends NamespaceBase<Context, Namespace> {
	init(importSpecList: ImportSpec[]) {
		this.importSpecList = importSpecList;

		// Separately defined document type is number 0.
		var importTypeOffset = 1;
		// Member number 0 is skipped.
		var importMemberOffset = 1;

		for(var importSpec of importSpecList) {
			importTypeOffset += importSpec[1].length;
			importMemberOffset += importSpec[2].length;
		}

		this.typeSpecList.length = importTypeOffset;
		this.memberSpecList.length = importMemberOffset;
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

	addMember(spec: MemberSpec) {
		this.memberSpecList.push(spec);

		if(spec.name) this.exportMemberTbl[spec.name] = spec;
	}

	typeByNum(num: number) {
		return(this.typeSpecList[num]);
	}

	memberByNum(num: number) {
		return(this.memberSpecList[num]);
	}

	link() {
		// Skip the document type.
		var typeNum = 1;
		var memberNum = 1;

		for(var importSpec of this.importSpecList) {
			var other = importSpec[0]._cxml[0];

			this.importNamespaceList.push(other);

			for(var typeName of importSpec[1]) {
				this.typeSpecList[typeNum++] = other.exportTypeTbl[typeName];
			}

			for(var memberName of importSpec[2]) {
				this.memberSpecList[memberNum++] = other.exportMemberTbl[memberName];
			}
		}

		this.exportOffset = typeNum;

		var typeSpecList = this.typeSpecList;
		var typeCount = typeSpecList.length;

		while(typeNum < typeCount) {
			var typeSpec = typeSpecList[typeNum++];

			if(typeSpec.item.parentNum) {
				typeSpec.item.setParent(typeSpecList[typeSpec.item.parentNum]);
			}
		}

		var memberSpecList = this.memberSpecList;
		var memberCount = memberSpecList.length;

		while(memberNum < memberCount) {
			var memberSpec = memberSpecList[memberNum++];

			if(memberSpec.item.parentNum) {
				memberSpec.item.setParent(memberSpecList[memberSpec.item.parentNum]);
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
	memberSpecList: MemberSpec[] = [];
	exportOffset: number;

	exportTypeTbl: { [name: string]: TypeSpec } = {};
	exportMemberTbl: { [name: string]: MemberSpec } = {};
}
