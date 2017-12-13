import { Token, TokenKind, OpenToken, StringToken } from './Token';
import { ParserConfig } from './ParserConfig';

export interface TokenElement extends OpenToken { new(): TokenElement }

export interface XModule {
	[name: string]: TokenElement;
}

export interface XModuleTable {
	[prefix: string]: XModule;
}

export interface XMLElementNode<Attributes> extends Array<string | Attributes | XMLNode[]> {
	0: any;
	1: Attributes;
	2: XMLNode[];
}

export class XMLArgumentNode {
	constructor(public name: string) {}
}

export type XMLNode = XMLElementNode<any> | XMLArgumentNode | string | number | boolean | undefined;

export function jsxElement<Attributes>(
	kind: string,
	attr: Attributes,
	...children: XMLNode[]
): XMLElementNode<Attributes>;

export function jsxElement() { return(Array.prototype.slice.apply(arguments)); }

export function jsxExpand(
	config: ParserConfig,
	node: XMLNode,
	output: (any[] | XMLArgumentNode)[],
	part = output[0] as any[]
) {
	if(typeof(node) != 'object') {
		part.push(node);
	} else if(node instanceof Array) {
		const element = node[0];
		const attributes = node[1] || {};

		// If the first element is not a token or the second element is,
		// then the node is already expanded!
		// An attribute, emitted or close token always follows
		// an open token in expanded nodes.

		if(!(element instanceof OpenToken) || attributes instanceof Token) {
			// Flatten and output the already expanded node.
			return(element instanceof Array ? Array.prototype.concat.apply([], node) : node);
		}

		part.push(element);

		for(let name of Object.keys(attributes)) {
			const attr = attributes[name];

			part.push(config.getAttributeTokens(element.ns, name)[TokenKind.string]!);

			if(attr instanceof XMLArgumentNode) {
				output.push(attr);
				part = [];
				output.push(part);
			} else {
				part.push(attr);
			}
		}

		if(node.length > 2) {
			part.push(element.emitted);

			for(let num = 2; num < node.length; ++num) {
				part = jsxExpand(config, node[num], output, part);
			}
		}

		part.push(element.close);
	} else if(node instanceof XMLArgumentNode) {
		output.push(node);
		part = [];
		output.push(part);
	}

	return(part);
}

export function jsxCompile(
	config: ParserConfig,
	generate: (...args: any[]) => XMLElementNode<any>
) {
	const template = generate((name: string) => new XMLArgumentNode(name));

	// console.log(require('util').inspect(template, { depth: null }));

	const parts: any[][] = [[]];
	jsxExpand(config, template, parts);

	const rest = parts.slice(1);

	// Compile a function that expands and interpolates arguments into the template.

	return(eval(
		// The function returns the first part of expanded output...
		'(function compiled(spec) {return(parts[0]' +
		// ...with other parts appended, if any.
		(!rest.length ? '' :
			'.concat(' + rest.map(
				(part, pos: number) => (part instanceof XMLArgumentNode ? (
					// Expand parts representing arguments.
					'jsxExpand(config,spec.' + part.name + '||"",[[]])'
				) : (
					// Output already expanded parts as-is.
					'rest[' + pos + ']'
				))
			).join(',') + ')'
		) +
		');})'
	));
}
