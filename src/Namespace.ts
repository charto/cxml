/** Basic XML namespace definition. */

export class Namespace {

	constructor(
		/** Default xmlns prefix for serializing to XML. */
		public defaultPrefix: string,
		/** Unique identifier for the namespace, should be a valid URI. */
		public uri: string,
		/** Numeric ID for faster mapping of namespaces to local prefixes. */
		public id = Namespace.idLast++,
		/** Special namespaces represent processing instructions (always defined). */
		public isSpecial = false
	) {}

	addElement(name: string) { this.elementNameList.push(name); }
	addAttribute(name: string) { this.attributeNameList.push(name); }
	addLocation(url: string) { this.schemaLocationList.push(url); }

	elementNameList: string[] = [];
	attributeNameList: string[] = [];
	schemaLocationList: string[] = [];

	static idLast = 0;
	static unknown = new Namespace('', '', 0, true);
	static processing = new Namespace('?', '?', 0, true);
	static xml1998 = new Namespace('xml', 'http://www.w3.org/XML/1998/namespace');

}

Namespace.processing.addElement('xml');
