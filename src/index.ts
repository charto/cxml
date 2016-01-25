import * as fs from 'fs';

import { Token } from './tokenizer/Token';
import { Namespace } from './Namespace';

import { ElementSpec } from './schema/ElementSpec';
import { Parser, ParserConfig, RawNamespace } from './parser/Parser';
import { Writer } from './writer/Writer';

const ns = new Namespace('http://www.w3.org/XML/1998/namespace', 'xml');

ns.addElementTokens([ new Token('xml') ]);
ns.addAttributeTokens([ new Token('xmlns') ]);

const config = new ParserConfig();
config.addNamespace(new RawNamespace(ns.encode()));

const xml = new Parser(config);

fs.createReadStream(process.argv[2]).pipe(xml).pipe(new Writer()).pipe(process.stdout);
