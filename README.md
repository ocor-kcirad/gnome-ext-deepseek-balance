# DeepSeek Balance

A GNOME Shell extension that shows your DeepSeek balance in the top bar.

## Features

- Top-bar label showing your total balance
- Menu with status, emphasized total balance, and a relative last-updated time
- Click the last-updated row to refresh, or the icon to open the DeepSeek usage dashboard
- API key stored in the system keyring (Secret Service), never in GSettings

## Requirements

- GNOME Shell 50
- A DeepSeek API key: https://platform.deepseek.com/api_keys

## Build & install

```sh
npm install
npm run build:install
```

Log out and back in to load the extension, then enable it and add your API key in its preferences.

## Development

- `npm run build` — build the extension zip
- `npm run build:install` — build and install
- `npm run build:dev` — build, install, and reload GNOME Shell (X11 + unsafe mode only)
- `npm run check:lint` / `npm run check:format` / `npm run check:types`

## Project layout

- `src/extension.ts` — entry point; owns the usage service, refresh timer, and settings
- `src/indicator.ts` — panel button and dropdown menu
- `src/prefs.ts` — preferences window
- `src/lib/deepseek/` — DeepSeek API client and balance provider
- `src/lib/usage/` — provider-agnostic usage service
- `src/lib/api-key-store.ts` — API key storage via the Secret Service
- `src/lib/http.ts` — libsoup JSON helper
- `src/lib/tooltip.ts` — hover tooltip
