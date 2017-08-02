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

	/** bool parse(Buffer); */
	parse(p0: number[] | ArrayBuffer | DataView | Uint8Array | Buffer): boolean;
}

export class ParserConfig extends NBindBase {
	/** ParserConfig(); */
	constructor();

	/** void addNamespace(std::shared_ptr<Namespace>); */
	addNamespace(p0: Namespace): void;
}
