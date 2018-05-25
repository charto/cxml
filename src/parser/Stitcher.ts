import { ArrayType, encodeArray, decodeArray, concatArray } from '../Buffer';

export class Stitcher {

	setChunk(chunk: ArrayType) {
		this.chunk = chunk;
	}

	reset(buf: ArrayType, len: number) {
		this.partList = [ buf.slice(0, len) ];
		this.byteLen = len;
	}

	storeSlice(start: number, end?: number) {
		if(!this.partList) this.partList = [];
		if(end !== 0) {
			this.partList.push(this.chunk.slice(start, end));
			this.byteLen += (end || this.chunk.length) - start;
		}
	}

	/** getSlice helper for concatenating buffer parts. */
	private buildSlice(start: number, end?: number) {
		this.storeSlice(start, end);

		const result = decodeArray(concatArray(this.partList!, this.byteLen));
		this.partList = null;
		this.byteLen = 0;

		return(result);
	}

	/** Get a string from the input buffer. Prepend any parts left from
	  * previous code buffers. */
	getSlice(start: number, end?: number) {
		return((
			this.partList ? this.buildSlice(start, end) :
			decodeArray(this.chunk, start, end)
		).replace(/\r\n?|\n\r/g, '\n'));
	}

	/** Current input buffer. */
	private chunk: ArrayType;

	/** Storage for parts of strings split between chunks of input. */
	private partList: ArrayType[] | null = null;
	private byteLen = 0;

}
