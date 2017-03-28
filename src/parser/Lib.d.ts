export class NBindBase { free?(): void }

export class Namespace extends NBindBase {
	/** Namespace(Buffer); */
	constructor(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer);
}

export class Parser extends NBindBase {
	/** Parser(std::shared_ptr<ParserConfig>); */
	constructor(p0: ParserConfig);

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

	/** void addNamespace(std::shared_ptr<Namespace>); */
	addNamespace(p0: Namespace): void;
}
