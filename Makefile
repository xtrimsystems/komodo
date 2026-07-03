.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_.-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: deps
deps: ## Install dependencies with bun
	bun install

.PHONY: dev
dev: ## Run the TUI in dev mode (bun)
	bun run src/cli.tsx

.PHONY: list
list: ## Print discovered projects + status headlessly (no TUI)
	bun run src/cli.tsx --list

.PHONY: logos
logos: ## Preview the logo/sprite concepts in colour
	bun run scripts/logos.ts

.PHONY: komodo
komodo: ## Regenerate + preview the full komodo dragon in the terminal (truecolor)
	python3 scripts/komodo_gen.py >/dev/null
	bun run scripts/komodo.ts

.PHONY: komodo-small
komodo-small: ## Preview the banner-sized komodo in the terminal
	python3 scripts/komodo_gen.py >/dev/null
	bun run scripts/komodo.ts scripts/komodo_small.rows

.PHONY: build
build: ## Compile a self-contained binary to dist/komodo
	bun build src/cli.tsx --compile --outfile dist/komodo

.PHONY: typecheck
typecheck: ## Type-check with tsc (no emit)
	bunx tsc --noEmit

.PHONY: install-bin
install-bin: build ## Dev install: symlink the binary into ~/.local/bin (live rebuilds)
	mkdir -p $(HOME)/.local/bin
	ln -sf $(CURDIR)/dist/komodo $(HOME)/.local/bin/komodo
	@echo "linked $(HOME)/.local/bin/komodo -> $(CURDIR)/dist/komodo"

.PHONY: install
install: ## Build and install a standalone binary onto your PATH (~/.local/bin)
	bash scripts/install.sh

.PHONY: uninstall
uninstall: ## Remove the installed binary from ~/.local/bin
	rm -f $(HOME)/.local/bin/komodo
	@echo "removed $(HOME)/.local/bin/komodo"
