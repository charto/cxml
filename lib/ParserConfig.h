#pragma once

#include <vector>
#include <memory>

#include "Namespace.h"
#include "Patricia.h"

class ParserConfig {

	friend class Parser;

public:

	ParserConfig();

	uint32_t addNamespace(const std::shared_ptr<Namespace> ns);

private:

	std::vector<const std::shared_ptr<Namespace>> namespaceList;

	uint32_t xmlnsToken = Patricia :: notFound;

};
