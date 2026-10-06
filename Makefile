.NOTPARALLEL:

NPM := npm

.PHONY: ci install format format-check lint check architecture test coverage security build package

ci: build format-check lint check architecture coverage package policy security secrets

install:
	$(NPM) ci --ignore-scripts
format:
	$(NPM) run format
format-check:
	$(NPM) run format:check
lint:
	$(NPM) run lint
check:
	$(NPM) run check
architecture:
	$(NPM) run architecture
test:
	$(NPM) test
coverage:
	$(NPM) run test:coverage
security:
	$(NPM) run security
build:
	$(NPM) run build
package:
	npm pack --dry-run

policy:
	$(NPM) run policy
secrets:
	$(NPM) run secrets
