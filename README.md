cxml
====

`cxml` is a schema-aware streaming XML parser. It fully supports namespaces, derived types and (soon) substitution groups.
Output structure is defined mainly by schema, not the XML input.

Relevant schema files should be downloaded and parsed using [cxsd](https://github.com/charto/cxsd) before using them to parse documents.

Each XSD type maps to a JavaScript class, its attributes and elements becoming class members.
Types derived from other types become classes inheriting other classes.

Class prototypes have placeholders for members, pointing to a singleton placeholder instance of the correct XSD type.
The prototypes have a special flag mamber `_exists = true` and the placeholder instances have a member `_exists = false`.
This allows parsing `<foo></foo>` and checking `output.foo.bar.baz._exists` (assuming the schema would permit the inner `bar` and `baz`).
Since `bar` and `baz` become placeholders, the code is valid.
This allows testing for existence of `baz` without having to worry about whether the parent node `bar` exists.

If the schema allows multiple child elements with the same name, they become an array even if only one is present.
That means they can always be handled with the same code.

Related projects
----------------

- [node-xml4js](https://github.com/peerlibrary/node-xml4js) uses schema information to read XML into nicely structured objects.

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/cxml/master/LICENSE)

Copyright (c) 2016 BusFaster Ltd
