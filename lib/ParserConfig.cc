#include "ParserConfig.h"
#include "PatriciaCursor.h"

ParserConfig :: ParserConfig() {
	for(unsigned int i = 0; i < namespacePrefixTblSize; ++i) {
		namespacePrefixTbl[i] = std::make_pair(0, nullptr);
	}
}

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

		namespaceByUriToken[uri] = std::make_pair(ns, namespaceList[ns].get());

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
	method(bindPrefix);
	method(setPrefixTrie);
}

#endif
