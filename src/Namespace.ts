export class Namespace {

	/** @param uri Unique identifier for the namespace, should be a valid URI.
	  * @param defaultPrefix Default xmlns prefix for serializing to XML. */
	constructor(public defaultPrefix: string, public uri: string, id?: number, public isSpecial = false) {
		this.id = id || Namespace.idLast++;
	}

	addElement(name: string) { this.elementNameList.push(name); }
	addAttribute(name: string) { this.attributeNameList.push(name); }
	addLocation(url: string) { this.schemaLocationList.push(url); }

	elementNameList: string[] = [];
	attributeNameList: string[] = [];
	schemaLocationList: string[] = [];

	id: number;

	static idLast = 0;
	static unknown = new Namespace('xmlns', '', 0, true);
	static processing = new Namespace('?', '?', 0, true);

}
