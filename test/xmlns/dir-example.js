var cxml = require('../..');
var Primitive = require('./xml-primitives');

cxml.register('dir-example', exports, [
	[Primitive, ['number', 'string'], []]
], [
	'DirType',
	'FileType'
], [
	[0, 0, [[1, 0], [2, 0]], []],
	[0, 0, [[2, 3], [5, 0]], [[3, 1], [4, 0]]],
	[1, 2, [], [[3, 1], [4, 0], [6, 0], [7, 1]]],
	[3, 2, [], []]
], [
	['dir', [3], 0],
	['file', [4], 0],
	['inode', [1], 0],
	['name', [2], 0],
	['owner', [2], 0],
	['size', [1], 0],
	['sizeUnit', [5], 0]
]);
