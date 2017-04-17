#include "ParserConfig.h"
#include "PatriciaCursor.h"

ParserConfig :: ParserConfig() {}

void ParserConfig :: setPrefixTrie(nbind::Buffer buffer) {
	prefixTrie.setBuffer(buffer);

	if(xmlnsToken == Patricia :: notFound) {
		PatriciaCursor xmlnsCursor;

		// A prefix named "xmlns" must be defined.
		xmlnsCursor.init(prefixTrie);

		for(auto c : "xmlns") c && xmlnsCursor.advance(c);

		xmlnsToken = xmlnsCursor.getData();
	}
}

uint32_t ParserConfig :: addNamespace(const std::shared_ptr<Namespace> ns) {
	namespaceList.push_back(ns);

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

	method(setPrefixTrie);
	method(addNamespace);
	method(addUri);
}

#endif
