export class NBindBase { free?(): void }

export class Namespace extends NBindBase {
	/** Namespace(std::string); */
	constructor(p0: string);

	/** void setElementTrie(Buffer); */
	setElementTrie(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer): void;

	/** void setAttributeTrie(Buffer); */
	setAttributeTrie(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer): void;
}

export class Parser extends NBindBase {
	/** Parser(std::shared_ptr<ParserConfig>); */
	constructor(p0: ParserConfig);

	/** uint32_t addNamespace(std::shared_ptr<Namespace>); */
	addNamespace(p0: Namespace): number;

	/** bool addUri(uint32_t, uint32_t); */
	addUri(p0: number, p1: number): boolean;

	/** void setTokenBuffer(Buffer, cbFunction &); */
	setTokenBuffer(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer, p1: (...args: any[]) => any): void;

	/** void setPrefixTrie(Buffer, uint32_t); */
	setPrefixTrie(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer, p1: number): void;

	/** void setUriTrie(Buffer, uint32_t); */
	setUriTrie(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer, p1: number): void;

	/** bool parse(Buffer); */
	parse(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer): boolean;

	/** uint32_t row; -- Read-only */
	row: number;

	/** uint32_t col; -- Read-only */
	col: number;
}

export class ParserConfig extends NBindBase {
	/** ParserConfig(); */
	constructor();

	/** uint32_t addNamespace(std::shared_ptr<Namespace>); */
	addNamespace(p0: Namespace): number;

	/** bool addUri(uint32_t, uint32_t); */
	addUri(p0: number, p1: number): boolean;
}

export class Patricia extends NBindBase {
	/** Patricia(); */
	constructor();

	/** void setBuffer(Buffer); */
	setBuffer(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer): void;

	/** uint32_t find(const char *); */
	find(p0: string): number;
}
