// This file is part of cxml, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';
import * as Promise from 'bluebird';
import * as sax from 'sax';

import {Context} from '../xml/Context';
import {Namespace} from '../xml/Namespace';
import {Rule, RuleClass, HandlerInstance} from './Rule';
import {MemberRef} from '../xml/MemberRef';
import {State} from './State';
import {defaultContext} from '../importer/JS';

export interface CxmlDate extends Date {
	cxmlTimezoneOffset: number;
}

var converterTbl: { [type: string]: (item: string) => any } = {
	Date: ((item: string) => {
		var dateParts = item.match(/([0-9]+)-([0-9]+)-([0-9]+)(?:T([0-9]+):([0-9]+):([0-9]+)(\.[0-9]+)?)?(?:Z|([+-][0-9]+):([0-9]+))?/);

		if(!dateParts) return(null);

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
		) as CxmlDate;

		date.setTime(date.getTime() - (offset + date.getTimezoneOffset()) * 60000);
		date.cxmlTimezoneOffset = offset;

		return(date);
	}),
	boolean: ((item: string) => item == 'true'),
	string: ((item: string) => item),
	number: ((item: string) => +item)
};

function convertPrimitive(text: string, type: Rule) {
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
	attach<CustomHandler extends HandlerInstance>(handler: { new(): CustomHandler; }) {
		var proto = handler.prototype as CustomHandler;
		var realHandler = (handler as RuleClass).rule.handler;
		var realProto = realHandler.prototype as CustomHandler;

		for(var key of Object.keys(proto)) {
			realProto[key] = proto[key];
		}

		realHandler._custom = true;
	}

	parse<Output extends HandlerInstance>(stream: string | stream.Readable | NodeJS.ReadableStream, output: Output, context?: Context) {
		return(new Promise<Output>((resolve: (item: Output) => void, reject: (err: any) => void) =>
			this._parse<Output>(stream, output, context || defaultContext, resolve, reject)
		));
	}

	_parse<Output extends HandlerInstance>(
		stream: string | stream.Readable | NodeJS.ReadableStream,
		output: Output,
		context: Context,
		resolve: (item: Output) => void,
		reject: (err: any) => void
	) {
		var xml = sax.createStream(true, { position: true });
		let rule = (output.constructor as RuleClass).rule;
		var xmlSpace = context.registerNamespace('http://www.w3.org/XML/1998/namespace');

		let namespaceTbl: { [short: string]: [ Namespace, string ] } = {
			'': [rule.namespace, rule.namespace.getPrefix()],
			'xml': [xmlSpace, xmlSpace.getPrefix()]
		};

		var state = new State(null, null, rule, new rule.handler(), namespaceTbl);
		var rootState = state;
		let parentItem: HandlerInstance;

		/** Add a new xmlns prefix recognized inside current tag and its children. */

		function addNamespace(short: string, namespace: Namespace) {
			if(namespaceTbl[short] && namespaceTbl[short][0] == namespace) return;

			if(namespaceTbl == state.namespaceTbl) {
				// Copy parent namespace table on first write.
				namespaceTbl = {};

				for(let key of Object.keys(state.namespaceTbl)) {
					namespaceTbl[key] = state.namespaceTbl[key];
				}
			}

			namespaceTbl[short] = [ namespace, namespace.getPrefix() ];
		}

		xml.on('opentag', (node: sax.Tag) => {
			var attrTbl = node.attributes;
			var attr: string;
			var nodePrefix = '';
			var name = node.name;
			var splitter = name.indexOf(':');
			var item: HandlerInstance = null;

			namespaceTbl = state.namespaceTbl;

			// Read xmlns namespace prefix definitions before parsing node name.

			for(var key of Object.keys(attrTbl)) {
				if(key.substr(0, 5) == 'xmlns') {
					var nsParts = key.match(/^xmlns(:(.+))?$/);

					if(nsParts) {
						addNamespace(nsParts[2] || '', context.registerNamespace(attrTbl[key]));
					}
				}
			}

			// Parse node name and possible namespace prefix.

			if(splitter >= 0) {
				nodePrefix = name.substr(0, splitter);
				name = name.substr(splitter + 1);
			}

			// Add internal surrogate key namespace prefix to node name.

			var nodeNamespace = namespaceTbl[nodePrefix];
			name = nodeNamespace[1] + name;

			var child: MemberRef;
			let rule: Rule;

			if(state.rule) {
				child = state.rule.childTbl[name];

				if(child) {
					if(child.proxy) {
						rule = child.proxy.member.rule;
						state = new State(state, child.proxy, rule, new rule.handler(), namespaceTbl);
					}

					rule = child.member.rule;
				}
			}

			if(rule && !rule.isPlainPrimitive) {
				item = new rule.handler();

				// Parse all attributes.

				for(var key of Object.keys(attrTbl)) {
					splitter = key.indexOf(':');

					if(splitter >= 0) {
						var attrPrefix = key.substr(0, splitter);
						if(attrPrefix == 'xmlns') continue;

						var attrNamespace = namespaceTbl[attrPrefix];

						if(attrNamespace) {
							attr = attrNamespace[1] + key.substr(splitter + 1);
						} else {
							console.log('Namespace not found for ' + key);
							continue;
						}
					} else {
						attr = nodeNamespace[1] + key;
					}

					var ref = rule.attributeTbl[attr];

					if(ref && ref.member.rule.isPlainPrimitive) {
						item[ref.safeName] = convertPrimitive(attrTbl[key], ref.member.rule);
					}
				}

				if(state.parent) {
					Object.defineProperty(item, '_parent', {
						enumerable: false,
						value: state.parent.item
					});
				}

				Object.defineProperty(item, '_name', {
					enumerable: false,
					value: node.name
				});

				if(item._before) item._before();
			}

			state = new State(state, child, rule, item, namespaceTbl);
		});

		xml.on('text', function(text: string) {
			if(state.rule && state.rule.isPrimitive) {
				if(!state.textList) state.textList = [];
				state.textList.push(text);
			}
		});

		xml.on('closetag', function(name: string) {
			var member = state.memberRef;
			var obj = state.item;
			var item: any = obj;
			var text: string;

			if(state.rule && state.rule.isPrimitive) text = (state.textList || []).join('').trim();

			if(text) {
				var content = convertPrimitive(text, state.rule);

				if(state.rule.isPlainPrimitive) item = content;
				else obj.content = content;
			}

			if(obj && obj._after) obj._after();

			state = state.parent;

			if(member && member.proxy) {
				if(item) state.item[member.safeName] = item;
				item = state.item;

				state = state.parent;
				member = member.proxy;
			}

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
			resolve(rootState.item as any as Output);
		});

		xml.on('error', function(err: any) {
			console.error(err);
		});

		if(typeof(stream) == 'string') {
			xml.write(stream as string);
			xml.end();
		} else (stream as stream.Readable).pipe(xml);
	}
}
