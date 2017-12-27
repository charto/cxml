export { ArrayType, encodeArray, decodeArray, concatArray } from './Buffer';
export { CRC32, Hasher32 } from './CRC32';

import { Namespace } from './Namespace';
export { Namespace };
export { ParserConfig, ParserOptions, TokenTbl, Registry } from './parser/ParserConfig';
export { Parser, ParseError } from './parser/Parser';
export { Builder } from './builder/Builder';
export { Writer } from './writer/Writer';
export { JsonWriter } from './writer/JsonWriter';
export { TokenElement, defineElement, defineAttribute, jsxElement, jsxCompile, jsxExpand } from './parser/JSX';
export { TokenChunk } from './parser/TokenChunk';
export * from './parser/Token';

export const processing = Namespace.processing;
export const anonymous = Namespace.unknown;
export const xml1998 = Namespace.xml1998;
