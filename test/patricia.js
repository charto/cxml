var fs = require('fs');
var path = require('path');

var nbind = require('nbind');

var Patricia = require('../dist/tokenizer/Patricia').Patricia;
var Token = require('../dist/tokenizer/Token').Token;

var RawPatricia = nbind.init(path.resolve(__dirname, '..')).lib.Patricia;

var trie = new Patricia();

var tokenId = -1;
var wordList = (
	(
		fs.readFileSync(process.argv[2] || path.resolve(__dirname, 'words.txt'), { encoding: 'utf-8' })
	).split('\n').filter(
		function(word) { return(word.length > 1); }
	).map(
		function(name) { return(new Token(name, ++tokenId)); }
	)
);

trie.insertList(wordList);

var rawTrie = new RawPatricia();

rawTrie.setBuffer(trie.encode());

var word;

for(var i = 0; i < wordList.length; ++i) {
	word = wordList[i];
	result = rawTrie.find(word.name);
	if(result != word.id) console.error('ERROR in ' + result + ' ' + word.name);
}
