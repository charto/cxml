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

var converterTbl = {
	Date: ((item: string) => {
		var dateParts = item.match(/([0-9]+)-([0-9]+)-([0-9]+)(?:T([0-9]+):([0-9]+):([0-9]+)(\.[0-9]+)?)?(?:Z|([+-][0-9]+):([0-9]+))?/);
		var sec = (dateParts[6] || '0') + (dateParts[7] || '');
		var offset = +(dateParts[8] || '0') * 60 + +(dateParts[9] || '0');

		var date = new Date(
			+dateParts[1],
			+dateParts[2] - 1,
			+dateParts[3],
			+(dateParts[4] || '0'),
			+(dateParts[5] || '0'),
			+sec
		);

		offset += date.getTimezoneOffset();
		date.setTime(date.getTime() - offset * 60000);

		return(date);
	}),
	boolean: ((item: string) => !!item),
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
			var nodePrefix = '';
			var name = node.name;
			var splitter = name.indexOf(':');
			var item: HandlerInstance = null;

			if(splitter >= 0) {
				nodePrefix = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			var nodeNamespace = state.namespaceTbl[nodePrefix] || state.namespaceTbl[''];
			name = nodeNamespace[1] + name;

			var child: Member;
			var type: Type;

			if(state.type) child = state.type.childTbl[name];

			if(!child) {
				// TODO: only allow this if any kind of child is allowed.
				child = nodeNamespace[0].doc.getType().childTbl[name];
			}

			if(child) {
				type = child.type;

				if(!type.isPlainPrimitive) {
					var Handler = type.handler;
					item = new Handler();
				}

				for(var key of Object.keys(attrTbl)) {
					var attrPrefix = nodePrefix;
					attr = key;
					splitter = attr.indexOf(':');

					if(splitter >= 0) {
						attrPrefix = attr.substr(0, splitter);
						attr = attr.substr(splitter + 1);
					}

					if(attr == 'xmlns' || attrPrefix == 'xmlns') {
						if(attr == 'xmlns') attr = '';
						state.addNamespace(attr, this.context.registerNamespace(attrTbl[key]));
					} else if(item) {
						var attrNamespace = state.namespaceTbl[attrPrefix];
						if(attrNamespace) {
							attr = attrNamespace[1] + attr;
							var member = type.attributeTbl[attr];

							if(member) item[member.safeName] = attrTbl[key];
						} else console.log('prefix ' + attrPrefix);
					}
				}

				if(Handler && Handler.before) item.before();
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
