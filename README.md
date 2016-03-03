cxml
====

[![build status](https://travis-ci.org/charto/cxml.svg?branch=master)](http://travis-ci.org/charto/cxml)
[![dependency status](https://david-dm.org/charto/cxml.svg)](https://david-dm.org/charto/cxml)
[![npm version](https://img.shields.io/npm/v/cxml.svg)](https://www.npmjs.com/package/cxml)

`cxml` aims to be the most advanced schema-aware streaming XML parser for JavaScript and TypeScript.
It fully supports namespaces, derived types and substitution groups.
It can handle pretty hairy schema such as
[GML](http://www.opengeospatial.org/standards/gml),
[WFS](http://www.opengeospatial.org/standards/wfs) and extensions to them defined by
[INSPIRE](http://inspire.ec.europa.eu/).
Output is fully typed and structured according to the actual meaning of input data, as defined in the schema.

Introduction
------------

For example this XML:

```xml
<dir name="123">
	<owner>me</owner>
	<file name="test" size="123">
		data
	</file>
</dir>
```

can become this JSON (run `npm test` to see it happen):

```json
{
  "dir": {
    "name": "123",
    "owner": "me",
    "file": [
      {
        "name": "test",
        "size": 123,
        "content": "data"
      }
    ]
  }
}
```

Note the following:

- `"123"` can be a string or a number depending on the context.
- The `name` attribute and `owner` child element are represented in the same way.
- A `dir` has a single owner but can contain many files, so `file` is an array but `owner` is not.
- Output data types are as simple as possible while correctly representing the input.

See the [example schema](https://github.com/charto/cxml/blob/master/test/cache/xsd/localhost/example-dir.xsd)
that makes it happen. Schemas for formats like
[GML](http://schemas.opengis.net/gml/3.1.1/base/geometryPrimitives.xsd) and
[SVG](http://www.w3.org/TR/2002/WD-SVG11-20020108/SVG.xsd) are nastier,
but you don't have to look at them to use them through `cxml`.

Relevant schema files should be downloaded and compiled using
[cxsd](https://github.com/charto/cxsd) before using them to parse documents.
Check out the example schema
[converted to TypeScript](https://github.com/charto/cxml/blob/master/test/xmlns/dir-example.d.ts).

There's much more. What if we parse an empty dir:

```typescript
import * as cxml from 'cxml';
import * as example from 'cxml/test/xmlns/dir-example';

var parser = new cxml.Parser();

var result = parser.parse('<dir name="empty"></dir>', example.document);
```

Now we can print the result and try some magical features:

```typescript
result.then((doc: example.document) => {

    console.log( JSON.stringify(doc) );  // {"dir":{"name":"empty"}}
    var dir = doc.dir;

    console.log( dir instanceof example.document.dir.constructor );   // true
    console.log( dir instanceof example.document.file.constructor );  // false

    console.log( dir instanceof example.DirType );   // true
    console.log( dir instanceof example.FileType );  // false

    console.log( dir._exists );          // true
    console.log( dir.file[0]._exists );  // false (not an error!)

});
```

Unseen in the JSON output, every object is an instance of a constructor for the appropriate XSD schema type.
Its prototype also contains placeholders for valid children, which means you can refer to `a.b.c.d._exists` even if `a.b` doesn't exist.
This saves irrelevant checks when only the existence of a deeply nested item is interesting.
The magical `_exists` flag is `true` in the prototypes and `false` in the placeholder instances, so it consumes no memory per object.

We can also process data as soon as the parser sees it in the incoming stream:

```typescript
parser.attach(class DirHandler extends (example.document.dir.constructor) {

    /** Fires when the opening <dir> and attributes have been parsed. */

    _before() {
        console.log('Before ' + this.name + ': ' + JSON.stringify(this));
    }

    /** Fires when the closing </dir> and children have been parsed. */

    _after() {
        console.log('After  ' + this.name + ': ' + JSON.stringify(this));
    }

});
```

The best part: your code is fully typed with comments pulled from the schema!

Related projects
----------------

- [node-xml4js](https://github.com/peerlibrary/node-xml4js) uses schema information to read XML into nicely structured objects.

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/cxml/master/LICENSE)

Copyright (c) 2016 BusFaster Ltd
