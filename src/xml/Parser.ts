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

var converterTbl = {
	string: ((item: string) => item),
	number: ((item: string) => +item)
};

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

		var state = new State(null, null, type, new type.handler());
		var rootState = state;
		state.addNamespace('', this.namespace);

		xml.on('opentag', (node: sax.Tag) => {
			var attrTbl = node.attributes;
			var attr: string;
			var nodeNamespace = '';
			var name = node.name;
			var splitter = name.indexOf(':');
			var item: HandlerInstance = null;

			if(splitter >= 0) {
				nodeNamespace = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			name = state.namespacePrefixTbl[nodeNamespace] + name;

			var child = state.type.childTbl[name];
			var type = child.type;

			if(!type.isPlainPrimitive) {
				var Handler = type.handler;
				item = new Handler();
			}

			for(var key of Object.keys(attrTbl)) {
				var attrNamespace = nodeNamespace;
				attr = key;
				splitter = attr.indexOf(':');

				if(splitter >= 0) {
					attrNamespace = attr.substr(0, splitter);
					attr = attr.substr(splitter + 1);
				}

				if(attr == 'xmlns' || attrNamespace == 'xmlns') {
					if(attr == 'xmlns') attr = '';
					state.addNamespace(attr, this.context.registerNamespace(attrTbl[key]));
				} else if(item) {
					attr = state.namespacePrefixTbl[attrNamespace] + attr;
					var member = type.attributeTbl[attr];

					if(member) item[member.safeName] = attrTbl[key];
				}
			}

			if(Handler && Handler.before) item.before();

			state = new State(state, child, type, item);
		});

		xml.on('text', function(text: string) {
			if(state.type.isPrimitive) {
				if(!state.textList) state.textList = [];
				state.textList.push(text);
			}
		});

		xml.on('closetag', function(name: string) {
			var member = state.memberSpec;
			var obj = state.item;
			var item: any = obj;
			var text: string;

			if(state.type.isPrimitive) text = (state.textList || []).join('').trim();

			if(text) {
				var content: any;
				var converter = converterTbl[state.type.primitiveType];

				if(converter) {
					if(state.type.isList) {
						content = text.trim().split(/\s+/).map(converter);
					} else {
						content = converter(text.trim());
					}
				}

				if(state.type.isPlainPrimitive) item = content;
				else obj.content = content;
			}

			if(obj && member.type.handler.after) obj.after();

			state = state.parent;
			var parent = state.item;

			if(parent) {
				if(member.max > 1) {
					if(!parent.hasOwnProperty(member.safeName)) parent[member.safeName] = [];
					parent[member.safeName].push(item);
				} else parent[member.safeName] = item;
			}
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
