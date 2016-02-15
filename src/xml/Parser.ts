// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';
import * as Promise from 'bluebird';
import * as sax from 'sax';

import {Context} from './Context';
import {Namespace} from './Namespace';
import {Type, TypeClass, HandlerInstance} from './Type';
import {State} from './State';
import {defaultContext} from '../importer/JS';

export class Parser {
	constructor(namespace: any, context?: Context) {
		this.context = context || defaultContext;
		this.namespace = namespace._cxml[0];
	}

	attach<CustomHandler extends HandlerInstance>(handler: { new(): CustomHandler; type?: Type; }) {
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
		var type = this.namespace.doc.getType();

		var state = new State(null, type, new type.handler());
		var rootState = state;
		state.addNamespace('', this.namespace);

		xml.on('opentag', (node: sax.Tag) => {
			var attrTbl = node.attributes;
			var attr: string;
			var ns = '';
			var name = node.name;
			var splitter = name.indexOf(':');
			var item: HandlerInstance = null;

			if(splitter >= 0) {
				ns = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			name = state.namespacePrefixTbl[ns] + name;

			var member = state.type.childTbl[name];
			var type = member.type;

//			if(type.handler.custom) {
				var Handler = type.handler;
				item = new Handler();
				var parent = state.item;

				if(parent) {
					if(member.max > 1) {
						if(!parent.hasOwnProperty(member.safeName)) parent[member.safeName] = [];
						parent[member.safeName].push(item);
					} else parent[member.safeName] = item;
				}
//			}

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
					member = type.attributeTbl[attr];

					if(member) item[member.safeName] = attrTbl[key];
				}
			}

			if(Handler && Handler.before) item.before();

			state = new State(state, type, item);
		});

		xml.on('closetag', function(name: string) {
			if(state.item && state.type.handler.after) state.item.after();

			state = state.parent;
		});

		xml.on('text', function(text: string) {
		});

		xml.on('end', function() {
			console.log(JSON.stringify(rootState.item, null, 2));
		});

		xml.on('error', function(err: any) {
			console.error(err);
		});

		stream.pipe(xml);
	}

	context: Context;
	namespace: Namespace;
}
