import { Namespace } from './Namespace';
export { Namespace };
export { ParserConfig } from './parser/ParserConfig';
export { Parser } from './parser/Parser';
export { Writer } from './writer/Writer';

export const anonymous = new Namespace('xmlns', '');
export const xml1998 = new Namespace('xml', 'http://www.w3.org/XML/1998/namespace');
