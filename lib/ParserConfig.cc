#include "ParserConfig.h"
#include "PatriciaCursor.h"

ParserConfig :: ParserConfig(
	uint32_t xmlnsToken,
	uint32_t emptyPrefixToken,
	uint32_t xmlnsPrefixToken,
	uint32_t processingPrefixToken
) :
	xmlnsToken(xmlnsToken),
	emptyPrefixToken(emptyPrefixToken),
	xmlnsPrefixToken(xmlnsPrefixToken),
	processingPrefixToken(processingPrefixToken)
{
	for(unsigned int i = 0; i < namespacePrefixTblSize; ++i) {
		namespacePrefixTbl[i] = std::make_pair(0, nullptr);
	}
	// Ensure that valid namespace indices start from 1.
	// TODO: Do we still need this?
	namespaceList.push_back(nullptr);
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
	construct<uint32_t, uint32_t, uint32_t, uint32_t>();

	method(addNamespace);
	method(addUri);
	method(bindPrefix);

	method(setUriTrie);
	method(setPrefixTrie);
}

#endif
