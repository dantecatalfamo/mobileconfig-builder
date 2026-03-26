# mobileconfig Builder

Browser-based tool for generating Apple `.mobileconfig` configuration profiles and Declarative Device Management (DDM) declaration JSON. All fields, types, and descriptions come from Apple's official [device-management](https://github.com/apple/device-management) schema repository. No backend required.

## Setup

```bash
git clone --recurse-submodules <repo-url>
cd mobileconfig-builder
npm install
npm run build
```

If you cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Usage

`npm run build` produces a single self-contained `dist/index.html` with everything inlined.

`npm run dev` starts a Vite dev server for development.

The app has two modes, switchable in the header:

- **MDM Profiles** — build configuration profiles with any number of payloads, download as `.mobileconfig` (plist XML)
- **Declarative** — build DDM declarations, download as `declarations.json`

## Updating schemas

```bash
npm run update-schemas:pull   # pull latest from Apple's repo + regenerate src/schemas.json
npm run build
```

`npm run update-schemas` regenerates from the current submodule checkout without fetching. The `prebuild` hook runs this automatically on every build.
