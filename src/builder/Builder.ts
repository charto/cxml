import { Namespace } from '../Namespace';
import { Token, TokenKind, OpenToken, CloseToken, StringToken } from '../parser/Token';
import { Parser, TokenBuffer, TokenChunk } from '../parser/Parser';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	AFTER_TEXT,
	COMMENT
}

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

interface RuleRef {
	rule: Rule;
	isArray?: boolean;
}

class Rule {
	elements: { [ elementName: string ]: RuleRef } = {};
	attributes: { [ attributeName: string ]: boolean } = {};

	static string = new Rule();
}

export class Builder {
	constructor(schema: any) {
		const ruleTbl: { [ typeName: string ]: Rule } = {
			string: Rule.string
		};
		let parts: RegExpMatchArray | null;

		let prefix: string, name: string, suffix: string;
		let rule: Rule;

		for(let typeName of Object.keys(schema)) {
			ruleTbl[typeName] = new Rule();
		}

		for(let typeName of Object.keys(schema)) {
			rule = ruleTbl[typeName];

			for(let child of schema[typeName]) {
				if(typeof(child) == 'string') {
					parts = child.match(/([$]?)([^\[]+)(\[\])?/);
					if(parts) {
						[, prefix, name, suffix] = parts;

						if(prefix == '$') {
							rule.attributes[name] = true;
						} else if(suffix == '[]') {
							rule.elements[name] = { rule: ruleTbl[name], isArray: true };
						} else {
							rule.elements[name] = { rule: ruleTbl[name] };
						}
					}
				} else {
					for(let key of Object.keys(child)) {
						rule.elements[key] = { rule: ruleTbl[child[key]] };
					}
				}
			}
		}

		this.documentRule = ruleTbl['document'];
	}

	build(parser: Parser, cb: any) {
		const document: any = {};
		let stackPos = 0;

		let rule = this.documentRule;
		const ruleStack: Rule[] = [];

		let item = document;
		let itemNext: any;
		const itemStack: any[] = [];

		let state = State.TEXT;
		let target: string | null;

		parser.on('data', (chunk: TokenChunk) => {
			let buffer = chunk.buffer;
			let token: Token | number | string;
			let ruleRef: RuleRef;
			let ruleNext: Rule | undefined;
			let name: string;
			const lastNum = chunk.last;
			let tokenNum = -1;
			let depth = 0;

			while(tokenNum < lastNum) {

				token = buffer[++tokenNum];

				if(depth) {
					if(token instanceof Token) {
						if(token.kind == TokenKind.open) ++depth;
						else if(token.kind == TokenKind.close) --depth;
					}
				} else if(token instanceof Token) {
					switch(token.kind) {
						case TokenKind.open:

							name = (token as OpenToken).name;
							ruleRef = rule.elements[name];
							ruleNext = ruleRef.rule;

							if(!ruleNext) {
								++depth;

								state = State.TEXT;
								break;
							}

							if(ruleNext == Rule.string) {
								target = name;
								itemNext = item;
							} else {
								itemNext = {};
								if(ruleRef.isArray) {
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

							state = State.TEXT;
							break;

						case TokenKind.close:

							item = itemStack[--stackPos];
							rule = ruleStack[stackPos];

							state = State.TEXT;
							break;

						case TokenKind.string:

							name = (token as StringToken).name;
							if(rule.attributes[name]) target = name;

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

							if(target) {
								item[target] = token;
								target = null;
							}

							break;
					}
				}
			}
		});

		parser.on('end', () => cb(document));
	}

	private documentRule: Rule;
}
