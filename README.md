# mobileconfig Builder

A browser-based tool for generating Apple `.mobileconfig` configuration profiles, driven directly by Apple's official [device-management](https://github.com/apple/device-management) schema repository.

---

## Setup

```bash
# Clone with submodule
git clone --recurse-submodules <your-repo-url>
cd mobileconfig-builder

# Install dependencies
npm install

# Build (automatically regenerates schemas from submodule)
npm run build
```

If you cloned without `--recurse-submodules`:
```bash
git submodule update --init --recursive
```

---

## Updating the Apple Schemas

Apple publishes schema updates to the `release` branch of [apple/device-management](https://github.com/apple/device-management).

### Pull latest + regenerate schemas + rebuild

```bash
npm run update-schemas:pull   # pulls submodule then regenerates src/schemas.json
npm run build                 # rebuilds the app
```

### Just regenerate from current submodule (no network)

```bash
npm run update-schemas        # reads device-management/ and writes src/schemas.json
npm run build
```

### Manual submodule update

```bash
git submodule update --remote --merge device-management
npm run build   # prebuild hook runs update-schemas automatically
```

---

## How it works

| File | Purpose |
|------|---------|
| `device-management/` | Git submodule — Apple's schema repo |
| `scripts/update-schemas.js` | Reads all `mdm/profiles/*.yaml` files, outputs `src/schemas.json` |
| `src/schemas.json` | Bundled schema data imported by the React app |
| `src/App.jsx` | Schema-driven form engine + plist generator |

`npm run build` runs `prebuild` first, which always regenerates `schemas.json` from whatever is checked out in the submodule — so the built app is always in sync.

---

## Development

```bash
npm run dev     # start Vite dev server (also runs prebuild)
```

The output is a single self-contained `dist/index.html` with all JS, CSS, and schema data inlined — open it in any browser with no server required.
