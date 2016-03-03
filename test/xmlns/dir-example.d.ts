import * as Primitive from './xml-primitives';

// Source files:
// http://localhost/example-dir.xsd


interface BaseType {
	_exists: boolean;
	_namespace: string;
}
/** Example directory type containing files.
  *
  * Note that it cannot contain other directories. */
interface _DirType extends BaseType {
	inode?: number;
	name: string;
	/** Example file element. Plain text file contents can be included inside. */
	file?: FileType[];
	owner: string;
}
export interface DirType extends _DirType { constructor: { new(): DirType }; }
export var DirType: { new(): DirType };

/** Example text file type with plain text contents included.
  *
  * Note that it has no owner. */
interface _FileType extends Primitive._string {
	inode?: number;
	name: string;
	/** Size of the file in bytes. Set sizeUnit to use another unit. */
	size: number;
	sizeUnit?: FileTypeSizeUnitType;
}
export interface FileType extends _FileType { constructor: { new(): FileType }; }
export var FileType: { new(): FileType };

type FileTypeSizeUnitType = ("b" | "kb" | "mb");
interface _FileTypeSizeUnitType extends Primitive._string { content: FileTypeSizeUnitType; }

export interface document extends BaseType {
	/** Example directory element, usable as a root element. */
	dir: DirType;
	/** Example file element. Plain text file contents can be included inside. */
	file: FileType;
}
export var document: document;
