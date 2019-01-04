import { Namespace } from '../Namespace';
import { TokenChunk } from '../parser/TokenChunk';
import { Token, TokenBuffer, TokenKind, OpenToken, CloseToken, StringToken } from '../parser/Token';
import { ParserConfig, ParserOptions } from '../parser/ParserConfig';
import { Parser } from '../parser/Parser';
import { SimpleSchema, SimpleSchemaSpecTbl } from '../schema/SimpleSchema';
import { RuleSet, Rule, RuleMember } from './RuleSet';

import { ComplexType } from '../schema/ComplexType';
import { ElementInstance, ElementSpec, ElementMeta, ElementConstructor } from '../schema/Element';
import { ElementToken } from '../parser/Token';
import { BuilderConfig } from './BuilderConfig';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	COMMENT
}

export class Builder {

	constructor(private config: BuilderConfig, public nsUri: string) {
		const ruleSet = this.config.ruleSetTbl[nsUri];

		if(!ruleSet) throw(new Error('Unknown XML namespace ' + nsUri));

		this.rule = ruleSet.rootRule;
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

	write(chunk: TokenChunk) {
		if(!chunk) return;

		const parseUnknown = this.config.options.parseUnknown;
		let unknownDepth = this.unknownDepth;
		let state = this.state;
		let item = this.item;
		let rule = this.rule;
		let member = this.member;
		let target = this.target;
		let stackPos = this.stackPos;

		const ruleStack = this.ruleStack;
		const itemStack = this.itemStack;

		const buffer = chunk.buffer;
		let token: typeof buffer[0];
		let dataType: string;
		let kind: number;
		let id: number;
		let name: string;

		let itemNext: any;
		let ruleNext: Rule | undefined;

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
						} else if(!parseUnknown) {
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
						if(member || parseUnknown) {
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

		this.unknownDepth = unknownDepth;
		this.state = state;
		this.item = item;
		this.rule = rule;
		this.member = member;
		this.target = target;
		this.stackPos = stackPos;

		chunk.free();

		return(this.document);
	}

	document: any = {};
	private item = this.document;
	private rule?: Rule;
	private member?: RuleMember;
	private target?: string;

	private unknownType = new ComplexType();
	private unknownDepth = 0;

	private stackPos = 0;
	private ruleStack: (Rule | undefined)[] = [];
	private itemStack: any[] = [];

	private state = State.TEXT;

}
