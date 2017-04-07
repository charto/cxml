import * as path from 'path';
import * as nbind from 'nbind';
import * as Lib from './Lib';

export const lib = nbind.init<typeof Lib>(path.resolve(__dirname, '../..')).lib;

export const NativeParser = lib.Parser;
export type NativeParser = Lib.Parser;

export const NativeNamespace = lib.Namespace;
export type NativeNamespace = Lib.Namespace;

export const NativeConfig = lib.ParserConfig;
export type NativeConfig = Lib.ParserConfig;
