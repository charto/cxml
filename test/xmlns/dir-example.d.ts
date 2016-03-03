import * as Primitive from './xml-primitives';

// Source files:
// http://localhost/example-dir.xsd


interface BaseType {
	_exists: boolean;
	_namespace: string;
}
interface _DirType extends BaseType {
	inode?: number;
	name: string;
	file?: FileType[];
	owner: string;
}
export interface DirType extends _DirType { constructor: { new(): DirType }; }
export var DirType: { new(): DirType };

interface _FileType extends Primitive._string {
	inode?: number;
	name: string;
	size: number;
	sizeUnit?: FileTypeSizeUnitType;
}
export interface FileType extends _FileType { constructor: { new(): FileType }; }
export var FileType: { new(): FileType };

type FileTypeSizeUnitType = ("b" | "kb" | "mb");
interface _FileTypeSizeUnitType extends Primitive._string { content: FileTypeSizeUnitType; }

export interface document extends BaseType {
	dir: DirType;
	file: FileType;
}
export var document: document;
