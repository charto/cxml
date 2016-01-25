export const ArrayType: { new(data: number | number[]): ArrayType } = (
	typeof(Buffer) == 'function' ? Buffer : Uint8Array
);

export type ArrayType = Buffer | Uint8Array;

export function concatArray(list: ArrayType[], len: number) {
	let buf: ArrayType;

	// Concatenate all encoded buffers together.
	if(typeof(Buffer) == 'function') {
		buf = Buffer.concat(list as Buffer[], len);
	} else {
		buf = new Uint8Array(len);

		let offset = 0;
		for(let part of list) {
			buf.set(part, offset);
			offset += part.length;
		}
	}

	return(buf);
}
