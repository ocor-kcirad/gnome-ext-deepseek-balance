# AGENTS.md

## Project

GNOME Shell extension `DeepSeek Balance` — a top-bar indicator for DeepSeek balance. Scaffolded with `create-gnome-extension` (TypeScript). `metadata.json` declares `shell-version: ["50"]`, but the installed `@girs/gnome-shell` type package is v46, so newer shell APIs may lack type definitions.

## Commands

- Build zip: `npm run build`
- Build + install: `npm run build:install`
- Build + install + reload GNOME Shell: `npm run build:dev` (X11 + GNOME unsafe mode only)
- Lint / format / types: `npm run check:lint`, `npm run check:format`, `npm run check:types`

No test suite. Run all three `check:*` commands after code changes. `check:lint` and `check:format` only cover `src/**/*.{js,ts}`; `scripts/` and config files are unchecked.

Build requires `zip` and `glib-compile-schemas` (`gnome-extensions` too for install). `msgfmt` / `glib-compile-resources` are only invoked if `po/` or `data/` exist; neither exists yet.

## Architecture

- `src/extension.ts` — entry point; default-exports an `Extension`. Owns `UsageService`, the refresh timer, and settings handlers.
- `src/indicator.ts` — `UsageIndicator extends PanelMenu.Button`; panel label + balance menu.
- `src/prefs.ts` — `ExtensionPreferences` subclass; libadwaita (`Adw`) rows bound to GSettings.
- `src/lib/http.ts` — `requestJson` on libsoup 3.
- `src/lib/api-key-store.ts` — API key in the Secret Service (libsecret); the extension never stores it in GSettings.
- `src/lib/deepseek/` — `DeepSeekClient` (`GET /user/balance`) + `DeepSeekBalanceProvider`.
- `src/lib/usage/` — provider-agnostic `UsageService` / `UsageProvider` / `UsageSnapshot`. Add new data sources as providers.
- `scripts/build.sh` — compiles TS, GSettings schemas, translations, GResources, then zips.
- `scripts/esbuild.js` — transpiles each `src/**/*.ts` to `dist/`; **does not bundle** and leaves `gi://` / `resource://` imports external. Non-TS `src/` files are copied to `dist/` by `build.sh`.

## Gotchas

- Relative imports need explicit `.js` extensions (`module: nodenext`); `import './foo'` fails `check:types`.
- To use a new `gi://` namespace, add its `@girs/<pkg>` import to `ambient.d.ts`, or tsc reports `Cannot find module 'gi://X'`. Example: libsoup is enabled by `import '@girs/soup-3.0'`.
- Because esbuild does not bundle, runtime imports must resolve inside the extension: only relative paths, `gi://`, and `resource://`. Do not import npm packages at runtime.
- GSettings: the schema `id` must equal `metadata.json` `settings-schema`; `build.sh` compiles schemas to `dist/schemas/gschemas.compiled`.

## DeepSeek API

- Public API exposes only `GET /user/balance` (balance, granted, topped-up) and `GET /models`. Total cost, request counts, and token usage are **not** available via the API.
- Auth `Authorization: Bearer <api-key>`; base URL `https://api.deepseek.com`.

## Conventions

- TypeScript strict, target `es2022`, module `nodenext`.
- GNOME Shell/GJS APIs via `resource:///org/gnome/...` and `gi://...`; types from `@girs/*`, ambient declarations in `ambient.d.ts`.
- Prettier: `tabWidth: 4`, `singleQuote: true`, `bracketSpacing: false` (JSON/YAML use `tabWidth: 2`).
- No comments unless necessary.
- Never log or commit secrets. The DeepSeek API key lives in the Secret Service via `src/lib/api-key-store.ts`, not in GSettings/dconf. Uninstalling the extension does not delete the keyring entry; users remove it via the prefs "Remove stored API key" action.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, ...), imperative mood.
- Gitignored build artifacts: `dist/`, `*.zip`, `*.shell-extension/`, `*.gresource*`, `locale/`, `node_modules/`.
