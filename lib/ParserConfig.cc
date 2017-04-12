#include "ParserConfig.h"
#include "PatriciaCursor.h"

ParserConfig :: ParserConfig() {}

uint32_t ParserConfig :: addNamespace(const std::shared_ptr<Namespace> ns) {
	namespaceList.push_back(ns);

	if(xmlnsToken == Patricia :: notFound) {
		PatriciaCursor xmlnsCursor;

		// Every namespace must include an attribute named "xmlns".
		xmlnsCursor.init(namespaceList[0]->attributeTrie);

		for(auto c : "xmlns") c && xmlnsCursor.advance(c);

		xmlnsToken = xmlnsCursor.getData();
	}

	return(namespaceList.size() - 1);
}

bool ParserConfig :: addUri(uint32_t uri, uint32_t ns) {
	if(ns < namespaceList.size()) {
		if(uri >= namespaceByUriToken.size()) {
			namespaceByUriToken.resize(uri + 1);
		}

		namespaceByUriToken[uri] = namespaceList[ns].get();

		return(true);
	}

	return(false);
}

#include <nbind/nbind.h>

#ifdef NBIND_CLASS

NBIND_CLASS(ParserConfig) {
	construct<>();

	method(addNamespace);
	method(addUri);
}

#endif
