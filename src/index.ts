import * as fs from 'fs';

import { Namespace } from './Namespace';
import { ParserConfig } from './parser/ParserConfig';
import { Parser } from './parser/Parser';
import { Writer } from './writer/Writer';

const anonymous = new Namespace('xmlns', '');
const xml1998 = new Namespace('xml', 'http://www.w3.org/XML/1998/namespace');
const nsTest = new Namespace('test', 'http://example.invalid/test');

anonymous.addElement('a');
nsTest.addElement('b');

const config = new ParserConfig();

config.addNamespace(anonymous);
config.addNamespace(xml1998);
config.addNamespace(nsTest);

config.bindNamespace(anonymous);

const parser = config.createParser();

// fs.createReadStream(process.argv[2]).pipe(xml).pipe(new Writer()).pipe(process.stdout);

parser.pipe(new Writer()).pipe(process.stdout);

//parser.write('<a xmlns:test="http://example.invalid/test"><test:b>foobar</test:b></a><test2:b xmlns:test2="http://example.invalid/test"/>');
//parser.end();

fs.createReadStream(process.argv[2]).pipe(parser);
