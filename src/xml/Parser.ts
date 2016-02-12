// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';
import * as Promise from 'bluebird';
import * as sax from 'sax';

import {Context} from './Context';
import {Namespace} from './Namespace';

export class State {
	constructor(parent: State) {
		this.parent = parent;

		if(parent) {
			this.namespacePrefixTbl = parent.namespacePrefixTbl;
		} else {
			this.namespacePrefixTbl = {'': ''};
		}
	}

	addNamespace(short: string, namespace: Namespace) {
		var key: string;
		var prefixTbl = this.namespacePrefixTbl;

		if(this.parent && prefixTbl == this.parent.namespacePrefixTbl) {
			prefixTbl = {};

			for(key of Object.keys(this.parent.namespacePrefixTbl)) {
				prefixTbl[key] = this.parent.namespacePrefixTbl[key];
			}

			this.namespacePrefixTbl = prefixTbl;;
		}

		prefixTbl[short] = namespace.id + ':';
	}

	parent: State;
	namespacePrefixTbl: { [short: string]: string };
}

export class Parser {
	constructor(context: Context) {
		this.context = context;
	}

	init(stream: stream.Readable) {
		var xml = sax.createStream(true, { position: true });

		var state = new State(null);

		xml.on('opentag', (node: sax.Tag) => {
			var name = node.name;
			var attrTbl = node.attributes;
			var attr: string;
			var ns = '';
			var splitter = name.indexOf(':');

			if(splitter >= 0) {
				ns = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			name = state.namespacePrefixTbl[ns] + name;

			for(var key of Object.keys(attrTbl)) {
				ns = '';
				attr = key;
				splitter = attr.indexOf(':');

				if(splitter >= 0) {
					ns = attr.substr(0, splitter);
					attr = attr.substr(splitter + 1);
				}

				if(attr == 'xmlns' || ns == 'xmlns') {
					if(attr == 'xmlns') attr = '';
					state.addNamespace(attr, this.context.registerNamespace(attrTbl[key]));
				} else {
					attr = state.namespacePrefixTbl[ns] + attr;

					// TODO: check if current rule allows the attribute.
				}
			}
		});

		xml.on('closetag', function(name: string) {
console.log('Close ' + name);
		});

		xml.on('text', function(text: string) {
		});

		xml.on('error', function(err: any) {
			console.error(err);
		});

		stream.pipe(xml);
	}

	context: Context;
}
