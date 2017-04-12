import * as fs from 'fs';

import { TokenSet } from './tokenizer/TokenSet';
import { Token } from './tokenizer/Token';
import { Namespace } from './Namespace';

import { ElementSpec } from './schema/ElementSpec';
import { Parser } from './parser/Parser';
import { ParserConfig } from './parser/ParserConfig';
import { Writer } from './writer/Writer';

const tokenSet = new TokenSet();
const ns = new Namespace(tokenSet, 'xml', 'http://www.w3.org/XML/1998/namespace');

ns.addElementTokens([ tokenSet.add('xml') ]);

const config = new ParserConfig();
config.addNamespace(ns);

config.addNamespace(new Namespace(tokenSet, 'xsi', 'http://www.w3.org/2001/XMLSchema-instance'));

const xml = new Parser(config, tokenSet);

fs.createReadStream(process.argv[2]).pipe(xml).pipe(new Writer()).pipe(process.stdout);
