import * as fs from 'fs';
import * as stream from 'stream';
import * as expat from 'node-expat';

const xml = new expat.Parser(null);

xml.on('startElement', (name: string, attributeTbl: {[name: string]: string}) => {
	// console.log(name);
	// console.log(attributeTbl);
});

const file = fs.createReadStream(process.argv[2]);

file.on('data', (data: Buffer) => xml.parse(data, false));

file.on('end', () => xml.parse('', true));
