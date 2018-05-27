import { Namespace } from '../Namespace';
import { ParserConfig, ParserOptions } from '../parser/ParserConfig';
import { SimpleSchema, SimpleSchemaSpecTbl } from '../schema/SimpleSchema';
import { RuleSet } from './RuleSet';
import { Builder } from './Builder';

export class BuilderConfig {

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

	createBuilder(nsUri: string) {
		return(new Builder(this, nsUri));
	}

	options: ParserOptions;
	ruleSetTbl: { [uri: string]: RuleSet } = {};

}
