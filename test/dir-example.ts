import * as fs from 'fs';
import * as path from 'path';
import * as cxml from 'cxml';
import * as example from 'cxml/test/xmlns/dir-example';

var parser = new cxml.Parser();

var result = parser.parse('<dir name="empty"></dir>', example.document);

result.then((doc: example.document) => {
	console.log('\n=== empty ===\n');

	console.log( JSON.stringify(doc) );  // {"dir":{"name":"empty"}}
	var dir = doc.dir;

	console.log( dir instanceof example.document.dir.constructor );   // true
	console.log( dir instanceof example.document.file.constructor );  // false

	console.log( dir instanceof example.DirType );   // true
	console.log( dir instanceof example.FileType );  // false

	console.log( dir._exists );          // true
	console.log( dir.file[0]._exists );  // false (not an error!)
});

result = parser.parse(fs.createReadStream(path.resolve(__dirname, 'xml/dir-example.xml')), example.document);

result.then((doc: example.document) => {
	console.log('\n=== 123 ===\n');

	console.log(JSON.stringify(doc, null, 2));
});
