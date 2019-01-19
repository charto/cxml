import * as stream from 'stream';

import { ArrayType } from '../Buffer';
import { Namespace } from '../Namespace';
import { ParserConfig } from './ParserConfig';
import { Parser } from './Parser';
import { TokenChunk } from './TokenChunk';
import {
	Token,
	TokenBuffer,
	TokenKind,
} from './Token';

 /** XML parser stream, emits tokens with fully qualified names. */

export class ParserStream extends stream.Transform {

	constructor(config: ParserConfig, public parser = config.createParser()) {
		super({ objectMode: true });
	}

	_flush( flush: (err: any, chunk: TokenChunk | null) => void) {
		this.parser.destroy(flush);
		flush(null, null);
	}

	_transform(
		chunk: string | ArrayType,
		enc: string,
		flush: (err: any, chunk: TokenChunk | null) => void
	) {
		this.parser.write(chunk, enc, flush);
	}

}
