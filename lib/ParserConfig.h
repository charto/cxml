#pragma once

#include <vector>
#include <memory>

#include "Namespace.h"

class ParserConfig {

	friend class Parser;

public:

	ParserConfig() {}

	void addNamespace(const std::shared_ptr<Namespace> ns) {
		namespaceList.push_back(ns);
	}

private:

	std::vector<const std::shared_ptr<Namespace>> namespaceList;

};
