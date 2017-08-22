export { ArrayType, encodeArray, decodeArray, concatArray } from './Buffer';
export { CRC32, Hasher32 } from './CRC32';

import { Namespace } from './Namespace';
export { Namespace };
export { ParserConfig, ParserOptions, TokenTbl, Registry } from './parser/ParserConfig';
export { Parser, ParseError, TokenBuffer } from './parser/Parser';
export { Builder } from './builder/Builder';
export { Writer } from './writer/Writer';
export * from './parser/Token';

export const processing = Namespace.processing;
export const anonymous = Namespace.unknown;
export const xml1998 = new Namespace('xml', 'http://www.w3.org/XML/1998/namespace');

processing.addElement('xml');
