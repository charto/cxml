export class Namespace {

	/** @param uri Unique identifier for the namespace, should be a valid URI.
	  * @param defaultPrefix Default xmlns prefix for serializing to XML. */
	constructor(public defaultPrefix: string, public uri: string) {}

	addElement(name: string) { this.elementNameList.push(name); }
	addAttribute(name: string) { this.attributeNameList.push(name); }

	elementNameList: string[] = [];
	attributeNameList: string[] = [];

}
