export declare class TextEncoder {
	constructor(encoding: string);

	encode(data: string): Uint8Array;
	decode(data: Uint8Array): string;
}

export type ArrayType = Buffer | Uint8Array;
export let ArrayType: { new(size: number): ArrayType };

export let encodeArray: (text: string) => ArrayType;
export let decodeArray: (data: ArrayType, start?: number, end?: number) => string;
export let concatArray: (list: ArrayType[], len: number) => ArrayType;

if(typeof(Buffer) == 'function') {
	ArrayType = Buffer;

	encodeArray = (text: string) => new Buffer(text);
	decodeArray = (data: ArrayType, start?: number, end?: number) => (data as Buffer).toString('utf-8', start, end);

	concatArray = Buffer.concat as any;
} else if(typeof(TextEncoder) == 'function') {
	ArrayType = Uint8Array;

	const encoder = new TextEncoder('utf-8');
	encodeArray = (text: string) => encoder.encode(name);
	decodeArray = (data: ArrayType, start?: number, end?: number) => encoder.decode(
		(start || end || end === 0) ? data.slice(start, end) : data
	);

	concatArray = (list: ArrayType[], len: number) => {
		const buf = new Uint8Array(len);

		let offset = 0;
		for(let part of list) {
			buf.set(part, offset);
			offset += part.length;
		}

		return(buf);
	}
}
