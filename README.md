# DeepSeek Balance

A GNOME Shell extension that shows your DeepSeek balance in the top bar.

## Features

- Top-bar label showing your total balance
- Dropdown with the current status, an emphasized total balance, and a relative last-updated time
- Click the last-updated row to refresh, or the DeepSeek icon to open the usage dashboard
- API key stored in the system keyring (Secret Service), never in GSettings

## Requirements

- GNOME Shell 50
- A DeepSeek API key: https://platform.deepseek.com/api_keys
- For building: `zip`, `glib-compile-schemas`, and `gnome-extensions` on `PATH`

## Build & install

```sh
npm install
npm run build:install
```

Then log out and back in so GNOME Shell picks up the extension, enable it, and add
your API key in its preferences:

```sh
gnome-extensions enable deepseek-balance@ocor-kcirad
gnome-extensions prefs deepseek-balance@ocor-kcirad
```

## Configuration

- **API key** — read from the system keyring. The extension never stores it in
  GSettings/dconf.
- **Remove stored API key** — deletes the keyring entry. Uninstalling the
  extension does *not* remove it, so use this action (or GNOME Passwords /
  Seahorse) to clean up.
- **Refresh interval** — how often, in seconds, the balance is refreshed
  (60–3600).

## Development

- `npm run build` — build the extension zip
- `npm run build:install` — build and install
- `npm run build:dev` — build, install, and reload GNOME Shell (X11 + unsafe mode only)
- `npm run check:lint` / `npm run check:format` / `npm run check:types`

There is no test suite.

## Project layout

- `src/extension.ts` — entry point; owns the usage service, refresh timer, and settings
- `src/indicator.ts` — panel button and dropdown menu
- `src/prefs.ts` — preferences window
- `src/lib/deepseek/` — DeepSeek API client and balance provider
- `src/lib/usage/` — provider-agnostic usage service
- `src/lib/api-key-store.ts` — API key storage via the Secret Service
- `src/lib/http.ts` — libsoup JSON helper
- `src/lib/tooltip.ts` — hover tooltip
- `src/schemas/` — GSettings schema (`refresh-interval`)
