// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';
import * as Promise from 'bluebird';
import * as sax from 'sax';

import {Context} from './Context';
import {Namespace} from './Namespace';
import {Type, TypeClass, HandlerInstance} from './Type';
import {Member} from './Member';
import {State} from './State';
import {defaultContext} from '../importer/JS';

var converterTbl: { [type: string]: (item: string) => any } = {
	Date: ((item: string) => {
		var dateParts = item.match(/([0-9]+)-([0-9]+)-([0-9]+)(?:T([0-9]+):([0-9]+):([0-9]+)(\.[0-9]+)?)?(?:Z|([+-][0-9]+):([0-9]+))?/);
		var offsetMinutes = +(dateParts[9] || '0');
		var offset = +(dateParts[8] || '0') * 60;

		if(offset < 0) offsetMinutes = -offsetMinutes;

		offset += offsetMinutes;

		var date = new Date(
			+dateParts[1],
			+dateParts[2] - 1,
			+dateParts[3],
			+(dateParts[4] || '0'),
			+(dateParts[5] || '0'),
			+(dateParts[6] || '0'),
			+(dateParts[7] || '0') * 1000
		);

		date.setTime(date.getTime() - (offset + date.getTimezoneOffset()) * 60000);

		return(date);
	}),
	boolean: ((item: string) => !!item),
	string: ((item: string) => item),
	number: ((item: string) => +item)
};

function convertPrimitive(text: string, type: Type) {
	var converter = converterTbl[type.primitiveType];

	if(converter) {
		if(type.isList) {
			return(text.trim().split(/\s+/).map(converter));
		} else {
			return(converter(text.trim()));
		}
	}

	return(null);
}

export class Parser {
	constructor(namespace: any, context?: Context) {
		this.context = context || defaultContext;
		this.namespace = namespace._cxml[0];
	}

	attach<CustomHandler extends HandlerInstance>(handler: { new(): CustomHandler; }) {
		var proto = handler.prototype as CustomHandler;
		var realHandler = (handler as TypeClass).type.handler;
		var realProto = realHandler.prototype as CustomHandler;

		for(var key of Object.keys(proto)) {
			realProto[key] = proto[key];
		}

		realHandler._custom = true;
	}

	parse(stream: stream.Readable) {
		var xml = sax.createStream(true, { position: true });
		var type = this.namespace.doc.getType();

		var xmlSpace = this.context.registerNamespace('http://www.w3.org/XML/1998/namespace');
		var state = new State(null, null, type, new type.handler());
		var rootState = state;

		state.addNamespace('', this.namespace);
		if(xmlSpace) state.addNamespace('xml', xmlSpace);

		xml.on('opentag', (node: sax.Tag) => {
			var attrTbl = node.attributes;
			var attr: string;
			var nodePrefix = '';
			var name = node.name;
			var splitter = name.indexOf(':');
			var item: HandlerInstance = null;

			// Read xmlns namespace prefix definitions before parsing node name.

			for(var key of Object.keys(attrTbl)) {
				if(key.substr(0, 5) == 'xmlns') {
					var nsParts = key.match(/^xmlns(:(.+))?$/);

					if(nsParts) {
						state.addNamespace(nsParts[2] || '', this.context.registerNamespace(attrTbl[key]));
					}
				}
			}

			// Parse node name and possible namespace prefix.

			if(splitter >= 0) {
				nodePrefix = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			// Add internal surrogate key namespace prefix to node name.

			var nodeNamespace = state.namespaceTbl[nodePrefix];
			name = nodeNamespace[1] + name;

			var child: Member;
			var type: Type;

			if(state.type) child = state.type.childTbl[name];

			if(!child) {
				// TODO: only allow this if any kind of child is allowed.
				child = nodeNamespace[0].doc.getType().childTbl[name];
			}

			if(child) type = child.type;

			if(type && !child.type.isPlainPrimitive) {
				item = new type.handler();

				// Parse all attributes.

				for(var key of Object.keys(attrTbl)) {
					splitter = key.indexOf(':');

					if(splitter >= 0) {
						var attrPrefix = key.substr(0, splitter);
						if(attrPrefix == 'xmlns') continue;

						var attrNamespace = state.namespaceTbl[attrPrefix];

						if(attrNamespace) {
							attr = attrNamespace[1] + key.substr(splitter + 1);
						} else {
							console.log('Namespace not found for ' + key);
							continue;
						}
					} else {
						attr = nodeNamespace[1] + key;
					}

					var member = type.attributeTbl[attr];

					if(member && member.type.isPlainPrimitive) item[member.safeName] = convertPrimitive(attrTbl[key], member.type);
				}

				if(item._before) item._before();
			}

			state = new State(state, child, type, item);
		});

		xml.on('text', function(text: string) {
			if(state.type && state.type.isPrimitive) {
				if(!state.textList) state.textList = [];
				state.textList.push(text);
			}
		});

		xml.on('closetag', function(name: string) {
			var member = state.memberSpec;
			var obj = state.item;
			var item: any = obj;
			var text: string;

			if(state.type && state.type.isPrimitive) text = (state.textList || []).join('').trim();

			if(text) {
				var content = convertPrimitive(text, state.type);

				if(state.type.isPlainPrimitive) item = content;
				else obj.content = content;
			}

			if(obj && obj._after) obj._after();

			state = state.parent;

			if(item) {
				var parent = state.item;

				if(parent) {
					if(member.max > 1) {
						if(!parent.hasOwnProperty(member.safeName)) parent[member.safeName] = [];
						parent[member.safeName].push(item);
					} else parent[member.safeName] = item;
				}
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
