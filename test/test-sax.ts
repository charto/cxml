import * as fs from 'fs';
import * as stream from 'stream';
import * as sax from 'sax';

const xml = sax.createStream(true, { position: true });

xml.on('opentag', (node: sax.Tag) => {
	// console.log(node);
});

fs.createReadStream(process.argv[2]).pipe(xml);
