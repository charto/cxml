#pragma once

#include <vector>
#include <memory>

#include "Namespace.h"
#include "Patricia.h"

class ParserConfig {

	friend class Parser;

public:

	ParserConfig();

	void setPrefixTrie(nbind::Buffer buffer);

	void setUriTrie(nbind::Buffer buffer) {
		uriTrie.setBuffer(buffer);
	}

	uint32_t addNamespace(const std::shared_ptr<Namespace> ns);

	bool addUri(uint32_t uri, uint32_t ns);

private:

	std::vector<const std::shared_ptr<Namespace>> namespaceList;
	std::vector<const Namespace *> namespaceByUriToken;

	uint32_t xmlnsToken = Patricia :: notFound;

	Patricia prefixTrie;
	Patricia uriTrie;

};
