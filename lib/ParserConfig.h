#pragma once

#include <vector>
#include <memory>

#include "Namespace.h"
#include "Patricia.h"

class ParserConfig {

	friend class Parser;

public:

	static constexpr uint32_t namespacePrefixTblSize = 256;

	ParserConfig();

	void setPrefixTrie(nbind::Buffer buffer);

	void setUriTrie(nbind::Buffer buffer) {
		uriTrie.setBuffer(buffer);
	}

	uint32_t addNamespace(const std::shared_ptr<Namespace> ns);

	bool addUri(uint32_t uri, uint32_t ns);

	bool bindPrefix(uint32_t idPrefix, uint32_t uri) {
		if(idPrefix >= namespacePrefixTblSize) return(false);
		if(uri >= namespaceByUriToken.size()) return(false);

		namespacePrefixTbl[idPrefix] = namespaceByUriToken[uri];
		return(true);
	}

private:

	std::vector<const std::shared_ptr<Namespace>> namespaceList;
	std::vector<std::pair<uint32_t, const Namespace *> > namespaceByUriToken;
	std::pair<uint32_t, const Namespace *> namespacePrefixTbl[namespacePrefixTblSize];

	uint32_t xmlnsToken = Patricia :: notFound;

	Patricia prefixTrie;
	Patricia uriTrie;

};
