import { ArrayType, encodeArray } from './Buffer';

export interface Hasher32 {
	append(data: string | ArrayType): number;
}

class Hasher implements Hasher32 {
	constructor(private tbl: number[]) {}

	append(data: string | ArrayType) {
		const tbl = this.tbl;
		let crc = this.crc;

		if(typeof(data) == 'string') data = encodeArray(data);

		let len = data.length;
		let pos = 0;

		for(let pos = 0; pos < len; ++pos) {
			crc = (crc >>> 8) ^ tbl[(crc & 0xff) ^ data[pos]];
		}

		this.crc = crc;

		return((crc ^ 0xffffffff) >>> 0);
	}

	crc = 0xffffffff;
}

/** 32-bit Cyclic Redundancy Check. */

export class CRC32 {
	/** @param poly Reversed generator polynomial, default edb88320 (Ethernet, GZIP, PNG).
	  * Other good choices are 82f63b78 (Castagnoli) used in Btrfs and eb31d82e (Koopman). */

	constructor(public poly = 0xedb88320) {
		for(let n = 0; n < 256; ++n) {
			let crc = n;
			let b = 8;

			while(b--) {
				crc = ((crc >>> 1) ^ (-(crc & 1) & poly)) >>> 0;
			}

			this.tbl[n] = crc;
		}
	}

	create(): Hasher32 {
		return(new Hasher(this.tbl));
	}

	tbl: number[] = [];
}
