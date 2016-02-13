// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';
import * as Promise from 'bluebird';
import * as sax from 'sax';

import {Context} from './Context';
import {Namespace} from './Namespace';
//import {Type} from './Type';
import {State} from './State';
import {defaultContext} from '../importer/JS';

export class Parser {
	constructor(namespace: any, context?: Context) {
		this.context = context || defaultContext;
		this.namespace = namespace._cxml[0];
	}

	parse(stream: stream.Readable) {
		var xml = sax.createStream(true, { position: true });

		var state = new State(null, this.namespace.doc.getType());

		xml.on('opentag', (node: sax.Tag) => {
			var attrTbl = node.attributes;
			var attr: string;
			var ns: string;
			var splitter: number

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

			var name = node.name;
			ns = '';
			splitter = name.indexOf(':');

			if(splitter >= 0) {
				ns = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			name = state.namespacePrefixTbl[ns] + name;

			console.log(name);
			state = new State(state, state.type.childTbl[name].type);
		});

		xml.on('closetag', function(name: string) {
			state = state.parent;
		});

		xml.on('text', function(text: string) {
		});

		xml.on('error', function(err: any) {
			console.error(err);
		});

		stream.pipe(xml);
	}

	context: Context;
	namespace: Namespace;
}
