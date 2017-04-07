#include "ParserConfig.h"
#include "PatriciaCursor.h"

ParserConfig :: ParserConfig() {}

uint32_t ParserConfig :: addNamespace(const std::shared_ptr<Namespace> ns) {
	namespaceList.push_back(ns);

	if(xmlnsToken == Patricia :: notFound) {
		PatriciaCursor xmlnsCursor;

		// Every namespace must include an attribute named "xmlns".
		xmlnsCursor.init(namespaceList[0]->attributeTrie);

		const char xmlnsLiteral[5] = { 'x', 'm', 'l', 'n', 's' };
		for(auto c : xmlnsLiteral) xmlnsCursor.advance(c);

		xmlnsToken = xmlnsCursor.getData();
	}

	return(namespaceList.size() - 1);
}

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(ParserConfig) {
	construct<>();

	method(addNamespace);
}

#endif
