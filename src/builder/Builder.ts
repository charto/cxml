import { Namespace } from '../Namespace';
import { Token, TokenKind, RecycleToken, OpenToken, CloseToken, StringToken } from '../parser/Token';
import { ParserConfig } from '../parser/ParserConfig';
import { Parser, TokenBuffer } from '../parser/Parser';
import { SimpleSchema, SimpleSchemaSpecTbl } from '../schema/SimpleSchema';
import { RuleSet, Rule, RuleMember } from './RuleSet';

const enum State {
	ELEMENT = 0,
	PROCESSING,
	TEXT,
	COMMENT
}

export class Builder {
	constructor(parserConfig: ParserConfig, schemaSpec: SimpleSchemaSpecTbl) {
		for(let prefix of Object.keys(schemaSpec)) {
			const [ defaultPrefix, nsUri, spec ] = schemaSpec[prefix];
			const ns = new Namespace(defaultPrefix, nsUri);

			if(spec['document']) {
				this.rootTbl[nsUri] = new RuleSet(new SimpleSchema(parserConfig, ns, spec)).rootRule;
			}
		}
	}

	build(parser: Parser, nsUri: string, cb: any) {
		const document: any = {};
		let stackPos = 0;

		let rule = this.rootTbl[nsUri];
		let member: RuleMember | undefined;
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
			let dataType: string;
			let kind: number;
			let id: number;
			let name: string;

			let lastNum = token instanceof RecycleToken ? token.lastNum : chunk.length - 1;
			let tokenNum = -1;

			while(tokenNum < lastNum) {

				token = chunk[++tokenNum];
				dataType = typeof(token);

				if(ignoreDepth) {
					if(dataType == 'object') {
						kind = (token as Token).kind;

						if(kind == TokenKind.open) ++ignoreDepth;
						else if(kind == TokenKind.close) --ignoreDepth;
					}
				} else if(dataType == 'object') {
					kind = (token as Token).kind;

						switch(kind) {
						case TokenKind.open:

							id = (token as OpenToken).id!;
							member = rule.elements[id];

							if(!member) {
								++ignoreDepth;

								state = State.TEXT;
								break;
							}

							name = (token as OpenToken).name;

							if(member.rule == Rule.string) {
								// NOTE: If the string element has attributes,
								// they're added to its parent element!
								target = name;
								itemNext = item;
							} else {
								itemNext = new member.rule.XMLType();
								if(member.max > 1) {
									if(!item.hasOwnProperty(name)) item[name] = [];
									item[name].push(itemNext);
								} else item[name] = itemNext;
							}

							itemStack[stackPos] = item;
							ruleStack[stackPos++] = rule;

							item = itemNext;
							rule = member.rule;

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

							id = (token as StringToken).id!;
							member = rule.attributes[id];
							if(member) target = (token as StringToken).name;

							break;

						case TokenKind.comment:

							state = State.COMMENT;
							break;
					}
				} else {
					switch(state) {
						case State.TEXT:
						case State.ELEMENT:

							if(member && target) {
								item[target] = member.max > 1 ? (token + '').split(/ +/) : token;
								target = null;
							}

							break;
					}
				}
			}
		});

		parser.on('end', () => cb(document));
	}

	rootTbl: { [uri: string]: Rule } = {};
}
