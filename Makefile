.PHONY: all build schemas update deploy release dev preview clean distclean

SUBMODULE_STAMP := device-management/.git
DEPS_STAMP := node_modules/.package-lock.json

all: build

# Build dist/index.html from scratch: submodule, npm deps, schemas, vite.
# Always rebuilds (it's fast), which keeps this Makefile portable across
# GNU and BSD make without needing a computed source list.
build: $(SUBMODULE_STAMP) $(DEPS_STAMP)
	npm run build

$(SUBMODULE_STAMP):
	git submodule update --init device-management

$(DEPS_STAMP): package.json package-lock.json
	npm ci

# Regenerate src/schemas.json from the local submodule.
schemas: $(SUBMODULE_STAMP) $(DEPS_STAMP)
	npm run update-schemas

# Pull the latest Apple schemas and rebuild.
update: $(SUBMODULE_STAMP) $(DEPS_STAMP)
	git submodule update --remote --merge device-management
	npm run build

# Upload the built site.
deploy: build
	sh deploy.sh

# Pull the latest schemas, rebuild, and upload.
release: update
	sh deploy.sh

dev: $(SUBMODULE_STAMP) $(DEPS_STAMP)
	npm run update-schemas
	npm run dev

preview: build
	npm run preview

clean:
	rm -rf dist

distclean: clean
	rm -rf node_modules
