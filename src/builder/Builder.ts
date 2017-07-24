import { Namespace } from '../Namespace';
import { Token, TokenKind, RecycleToken, OpenToken, CloseToken, StringToken } from '../parser/Token';
import { Parser, TokenBuffer } from '../parser/Parser';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	AFTER_TEXT,
	COMMENT
}

/*
export class ElementSpec {
	tagName: string;
	exists?: boolean;
	type?: any;
	template: Element;
	placeholder: Element;
}

export class Element {
	xmlns: Namespace;
	_: ElementSpec;
}
*/

interface Rule {
	type: RuleType;
	isArray?: boolean;
}

class RuleType {
	elements: { [ elementName: string ]: Rule } = {};
	attributes: { [ attributeName: string ]: Rule } = {};

	static string = new RuleType();
}

export class Builder {
	constructor(schema: any, roots = schema.document) {
		const typeTbl: { [ typeName: string ]: RuleType } = {
			roots: new RuleType(),
			string: RuleType.string
		};
		let parts: RegExpMatchArray | null;

		let prefix: string, name: string, suffix: string;
		let type: RuleType;

		for(let typeName of Object.keys(schema)) {
			typeTbl[typeName] = new RuleType();
		}

		let memberTbl: { [ name: string ]: Rule };
		let memberName: string;
		let memberType: RuleType;
		let memberTypeName: string;

		for(let typeName of Object.keys(typeTbl)) {
			type = typeTbl[typeName];
			let spec = schema[typeName];

			if(!spec) {
				if(typeName == 'roots') spec = roots;
				else continue;
			}

			for(let child of spec) {
				if(typeof(child) == 'string') {
					memberName = child;
					child = {};
					child[memberName] = memberName;
				}

				for(memberName of Object.keys(child)) {
					// Parse element or attribute name with type prefix / suffix.
					parts = memberName.match(/(@?)([^\[]+)(\[\])?/);
					if(!parts) continue;

					[, prefix, name, suffix] = parts;

					// Parse type name if it differs from element/attribute name.
					if(child[memberName] != memberName) {
						parts = child[memberName].match(/(@?)([^\[]+)(\[\])?/);
						if(!parts) continue;

						// Type prefix / suffix behave identically in member and type names.
						prefix = prefix || parts[1];
						suffix = suffix || parts[3];
					}

					memberTypeName = parts[2];

					// Prefix @ marks attributes, as in xpath.
					if(prefix == '@') {
						memberTbl = type.attributes;
						memberType = RuleType.string;
					} else {
						memberTbl = type.elements;
						memberType = typeTbl[memberTypeName];
					}

					memberTbl[name] = {
						type: memberType,
						isArray: suffix == '[]'
					};
				}
			}
		}

		this.rootRule = { type: typeTbl['roots'] };
	}

	build(parser: Parser, cb: any) {
		const document: any = {};
		let stackPos = 0;

		let rule = this.rootRule;
		let ruleNext: Rule | undefined;
		const ruleStack: Rule[] = [];

		let item = document;
		let itemNext: any;
		const itemStack: any[] = [];
		let ignoreDepth = 0;

		let state = State.TEXT;
		let target: string | null;

		parser.on('data', (chunk: TokenBuffer) => {
			if(!chunk) return;

			let token = chunk[0];
			let name: string;

			let lastNum = token instanceof RecycleToken ? token.lastNum : chunk.length - 1;
			let tokenNum = -1;

			while(tokenNum < lastNum) {

				token = chunk[++tokenNum];

				if(ignoreDepth) {
					if(token instanceof Token) {
						if(token.kind == TokenKind.open) ++ignoreDepth;
						else if(token.kind == TokenKind.close) --ignoreDepth;
					}
				} else if(token instanceof Token) {
					switch(token.kind) {
						case TokenKind.open:

							name = (token as OpenToken).name;
							ruleNext = rule.type.elements[name];

							if(!ruleNext) {
								++ignoreDepth;

								state = State.TEXT;
								break;
							}

							if(ruleNext.type == RuleType.string) {
								// NOTE: If the string element has attributes,
								// they're added to its parent element!
								target = name;
								itemNext = item;
							} else {
								itemNext = {};
								if(ruleNext.isArray) {
									if(!item[name]) item[name] = [];
									item[name].push(itemNext);
								} else item[name] = itemNext;
							}

							itemStack[stackPos] = item;
							ruleStack[stackPos++] = rule;

							item = itemNext;
							rule = ruleNext;

							state = State.ELEMENT;
							break;

						case TokenKind.emitted:

							if(rule.type == RuleType.string) ruleNext = rule;

							state = State.TEXT;
							break;

						case TokenKind.close:

							item = itemStack[--stackPos];
							rule = ruleStack[stackPos];

							state = State.TEXT;
							break;

						case TokenKind.string:

							name = (token as StringToken).name;
							ruleNext = rule.type.attributes[name];
							if(ruleNext) target = name;

							break;

						case TokenKind.comment:

							state = State.COMMENT;
							break;
					}
				} else {
					switch(state) {
						case State.TEXT:

							state = State.AFTER_TEXT;

						// Fallthru
						case State.ELEMENT:

							if(ruleNext && target) {
								item[target] = ruleNext.isArray ? (token + '').split(/ +/) : token;
								target = null;
							}

							break;
					}
				}
			}
		});

		parser.on('end', () => cb(document));
	}

	private rootRule: Rule;
}
