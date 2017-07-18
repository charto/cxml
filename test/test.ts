import * as fs from 'fs';
import * as path from 'path';

import * as nbind from 'nbind';
import * as Lib from '../dist/parser/Lib';

import { TokenSpace } from '../dist/tokenizer/TokenSpace';
import { Patricia } from '../dist/tokenizer/Patricia';

const lib = nbind.init<typeof Lib>(path.resolve(__dirname, '..')).lib;

function testPatricia() {
	const tokenSpace = new TokenSpace(0);
	const trie = new Patricia();
	const rawTrie = new lib.Patricia();

	const tokenList = fs.readFileSync(
		process.argv[2] || path.resolve(__dirname, 'words.txt'),
		{ encoding: 'utf-8' }
	).split('\n').filter(
		(name: string) => name.length > 1
	).map(
		(name: string) => tokenSpace.createToken(name)
	);

	trie.insertList(tokenList);
	rawTrie.setBuffer(trie.encode());

	let result: number;

	for(let token of tokenList) {
		result = rawTrie.find(token.name);
		if(result != token.id) {
			console.error('ERROR in ' + result + ' ' + token.name);
			process.exit(1);
		}
	}
}

testPatricia();
