# DeepSeek Balance

A GNOME Shell extension that shows your DeepSeek balance in the top bar.

> Not affiliated with DeepSeek. "DeepSeek" is used only to describe the
> service this extension integrates with.

## Features

- Top-bar label showing your total balance
- Dropdown with the current status, an emphasized total balance, and a relative last-updated time
- Click the currency toggle beside the total balance to cycle through the currencies returned by the API (shown only when there is more than one)
- Click the last-updated row to refresh, or the DeepSeek icon to open the usage dashboard
- API key stored in the system keyring (Secret Service), never in GSettings

## Requirements

- GNOME Shell 50
- A DeepSeek API key: https://platform.deepseek.com/api_keys

## Installation

### From extensions.gnome.org

Browse to https://extensions.gnome.org/ and search for **DeepSeek Balance**,
then toggle it on. Open its settings to add your API key.

### From source (quick deploy)

Builds and installs the extension into your user extensions directory in one
step. Requires `npm`, `zip`, `glib-compile-schemas`, and `gnome-extensions` on
`PATH`.

```sh
npm install
npm run build:install
```

Then reload GNOME Shell and enable the extension:

- Wayland: log out and back in (the shell can't be restarted in place).
- X11 + unsafe mode: `npm run build:dev` builds, installs, and restarts the shell.

```sh
gnome-extensions enable deepseek-balance@ocor-kcirad
gnome-extensions prefs deepseek-balance@ocor-kcirad   # add your API key
```

You can also toggle it and open its settings from the GNOME Extensions app.

### Manual installation

1. Build the package:

   ```sh
   npm install
   npm run build
   ```

   This produces `deepseek-balance@ocor-kcirad.shell-extension.zip` in the
   project root.

2. Install it with `gnome-extensions`:

   ```sh
   gnome-extensions install --force deepseek-balance@ocor-kcirad.shell-extension.zip
   ```

   Or copy the built files into the user extensions directory:

   ```sh
   EXT_DIR=~/.local/share/gnome-shell/extensions/deepseek-balance@ocor-kcirad
   mkdir -p "$EXT_DIR"
   cp -r dist/. "$EXT_DIR/"
   cp metadata.json "$EXT_DIR/"
   ```

3. Reload GNOME Shell (log out and back in on Wayland) and enable it:

   ```sh
   gnome-extensions enable deepseek-balance@ocor-kcirad
   ```

## Configuration

- **API key** — read from the system keyring. The extension never stores it in
  GSettings/dconf.
- **Remove stored API key** — deletes the keyring entry. Uninstalling the
  extension does *not* remove it, so use this action (or GNOME Passwords /
  Seahorse) to clean up.
- **Refresh interval** — how often, in seconds, the balance is refreshed
  (60–3600).
- **Display currency** — which balance to show when the API returns more than
  one (Auto, CNY, or USD). The currency toggle in the dropdown updates this
  setting.

## Development

- `npm run build` — build the extension zip
- `npm run build:install` — build and install
- `npm run build:dev` — build, install, and reload GNOME Shell (X11 + unsafe mode only)
- `npm run check:lint` / `npm run check:format` / `npm run check:types`

There is no test suite. Building requires `zip`, `glib-compile-schemas`, and
`gnome-extensions` on `PATH`.

## Project layout

- `src/extension.ts` — entry point; owns the usage service, refresh timer, and settings
- `src/indicator.ts` — panel button and dropdown menu
- `src/prefs.ts` — preferences window
- `src/lib/deepseek/` — DeepSeek API client and balance provider
- `src/lib/usage/` — provider-agnostic usage service
- `src/lib/api-key-store.ts` — API key storage via the Secret Service
- `src/lib/http.ts` — libsoup JSON helper
- `src/schemas/` — GSettings schema (`refresh-interval`, `currency`)
- `scripts/build.sh` — compiles TypeScript, schemas, translations, and resources, then zips the extension
- `scripts/esbuild.js` — transpiles each `src/**/*.ts` to `dist/`
- `metadata.json` — extension metadata (UUID, shell version, settings schema)

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
