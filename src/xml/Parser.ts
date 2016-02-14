// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';
import * as Promise from 'bluebird';
import * as sax from 'sax';

import {Context} from './Context';
import {Namespace} from './Namespace';
import {Type, TypeClass, Handler} from './Type';
import {State} from './State';
import {defaultContext} from '../importer/JS';

export class Parser {
	constructor(namespace: any, context?: Context) {
		this.context = context || defaultContext;
		this.namespace = namespace._cxml[0];
	}

	attach<CustomHandler extends Handler>(handler: { new(): CustomHandler; type?: Type; }) {
		var proto = handler.prototype as CustomHandler;
		var realHandler = (handler as TypeClass).type.handler;
		var realProto = realHandler.prototype as CustomHandler;

		for(var key of Object.keys(proto)) {
			realProto[key] = proto[key];
		}

		realHandler.custom = true;
		if(proto.before) realHandler.before = true;
		if(proto.after) realHandler.after = true;
	}

	parse(stream: stream.Readable) {
		var xml = sax.createStream(true, { position: true });

		var state = new State(null, this.namespace.doc.getType());
		state.addNamespace('', this.namespace);

		xml.on('opentag', (node: sax.Tag) => {
			var attrTbl = node.attributes;
			var attr: string;
			var ns = '';
			var name = node.name;
			var splitter = name.indexOf(':');

			if(splitter >= 0) {
				ns = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			name = state.namespacePrefixTbl[ns] + name;
			console.log(name);

			var type = state.type.childTbl[name].type;

			if(type.handler.custom) {
				var Handler = type.handler;
				var item = new Handler();
			}

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
				} else if(item) {
					attr = state.namespacePrefixTbl[ns] + attr;
					var member = type.attributeTbl[attr];

					if(member) item[member.safeName] = attrTbl[key];
				}
			}

			if(Handler && Handler.before) item.before();

			state = new State(state, type);
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
