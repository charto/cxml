import { Namespace } from '../Namespace';
import { TokenChunk } from '../parser/TokenChunk';
import { Token, TokenBuffer, TokenKind, OpenToken, CloseToken, StringToken } from '../parser/Token';
import { ParserConfig, ParserOptions } from '../parser/ParserConfig';
import { Parser } from '../parser/Parser';
import { SimpleSchema, SimpleSchemaSpecTbl } from '../schema/SimpleSchema';
import { RuleSet, Rule, RuleMember } from './RuleSet';

import { ComplexType } from '../schema/ComplexType';
import { Element, ElementSpec, ElementMeta, ElementConstructor } from '../schema/Element';
import { ElementToken } from '../parser/Token';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	COMMENT
}

export class Builder {
	constructor(parserConfig: ParserConfig, schemaSpec: SimpleSchemaSpecTbl) {
		this.options = parserConfig.options;

		for(let prefix of Object.keys(schemaSpec)) {
			const [ defaultPrefix, nsUri, spec ] = schemaSpec[prefix];
			const ns = new Namespace(defaultPrefix, nsUri);

			if(spec['document']) {
				this.ruleSetTbl[nsUri] = new RuleSet(new SimpleSchema(parserConfig, ns, spec));
			}
		}
	}

	getUnknownProto(token: ElementToken) {
		let elementSpec: ElementSpec | undefined = this.unknownType.elements && this.unknownType.elements.group!.tbl[token.id!] as ElementSpec;

		if(!elementSpec) {
			elementSpec = new ElementSpec(0, Infinity);
			const elementMeta = new ElementMeta(token);

			elementMeta.type = new ComplexType();
			elementSpec.meta = elementMeta;

			this.unknownType.addAll(elementSpec);
		}

		return(elementSpec.meta!.createProto());
	}


	build(parser: Parser, nsUri: string, cb: any) {
		const document: any = {};
		let stackPos = 0;

		let rule: Rule | undefined = this.ruleSetTbl[nsUri].rootRule;
		let ruleNext: Rule | undefined;
		let member: RuleMember | undefined;
		const ruleStack: (Rule | undefined)[] = [];

		let item = document;
		let itemNext: any;
		const itemStack: any[] = [];
		let unknownDepth = 0;

		let state = State.TEXT;
		let target: string | undefined;

		parser.on('data', (chunk: TokenChunk) => {
			if(!chunk) return;

			const buffer = chunk.buffer;
			let token: typeof buffer[0];
			let dataType: string;
			let kind: number;
			let id: number;
			let name: string;

			let lastNum = chunk.length - 1;
			let tokenNum = -1;

			while(tokenNum < lastNum) {

				token = buffer[++tokenNum];
				dataType = typeof(token);

				if(unknownDepth) {
					if(dataType == 'object') {
						kind = (token as Token).kind;

						if(kind == TokenKind.open) ++unknownDepth;
						else if(kind == TokenKind.close) --unknownDepth;
					}
				} else if(dataType == 'object') {
					kind = (token as Token).kind;

					switch(kind) {
						case TokenKind.open:

							id = (token as OpenToken).id!;
							name = (token as OpenToken).name;
							member = rule && rule.elements[id];

							if(member) {
								ruleNext = member.rule;

								if(ruleNext == Rule.string) {
									// NOTE: If the string element has attributes,
									// they're added to its parent element!
									target = name;
									itemNext = item;
								} else {
									itemNext = new ruleNext.XMLType();
									if(member.max > 1) {
										if(!item.hasOwnProperty(name)) item[name] = [];
										item[name].push(itemNext);
									} else item[name] = itemNext;
								}
							} else if(!this.options.parseUnknown) {
								++unknownDepth;

								state = State.TEXT;
								break;
							} else {

								ruleNext = void 0;
								itemNext = new (this.getUnknownProto(token as OpenToken))();

								if(!item.hasOwnProperty(name)) item[name] = itemNext;
								else if(item[name] instanceof Array) item[name].push(itemNext);
								else item[name] = [item[name], itemNext];
							}

							itemStack[stackPos] = item;
							ruleStack[stackPos++] = rule;
							item = itemNext;
							rule = ruleNext;

							state = State.ELEMENT;
							break;

						case TokenKind.close:

							item = itemStack[--stackPos];
							rule = ruleStack[stackPos];

						// Fallthru
						case TokenKind.emitted:

							if(rule != Rule.string) target = '$';

							state = State.TEXT;
							break;

						case TokenKind.string:

							id = (token as StringToken).id!;
							member = rule && rule.attributes[id];
							if(member || this.options.parseUnknown) {
								target = (token as StringToken).name;
							} else {
								target = void 0;
							}

							break;

						case TokenKind.comment:

							state = State.COMMENT;
							break;
					}
				} else {
					switch(state) {
						case State.TEXT:
						case State.ELEMENT:

							if(target) {
								item[target] = (member && member.max > 1) ? (token + '').split(/ +/) : token;
								target = void 0;
							}

							break;
					}
				}
			}

			chunk.free();
		});

		parser.on('end', () => cb(null, document));
	}

	options: ParserOptions;

	ruleSetTbl: { [uri: string]: RuleSet } = {};
	unknownType = new ComplexType();

}
