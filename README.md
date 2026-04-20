# Auto Close Tabs

A browser extension for [Zen Browser](https://zen-browser.app/) (and Firefox) that automatically closes inactive tabs after a configurable period of time.

## Features

- Closes non-pinned tabs that haven't been accessed for a configurable number of days (default: 7)
- Configurable scan interval (default: every 60 minutes)
- Protects pinned tabs, active tabs, and Zen Essentials
- Optionally protects tabs playing audio
- Domain whitelist to protect specific sites from being closed
- First-run warning showing how many tabs would be affected before any are closed
- Keeps at least one tab open per window
- Uses the browser's native color theme

## Installation

### Temporary install (removed on browser restart)

1. Open `about:debugging#/runtime/this-firefox` in Zen
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from this directory

### Permanent install (requires signing)

1. Build the extension:
   ```bash
   npm install -g web-ext
   cd zen-auto-close-tabs
   web-ext build
   ```

2. Sign it with your [AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/):
   ```bash
   web-ext sign --api-key=YOUR_JWT_ISSUER --api-secret=YOUR_JWT_SECRET
   ```

3. Install the resulting `.xpi` file by dragging it into Zen or via `about:addons`

### Development

```bash
web-ext run -f /path/to/zen
```

## Settings

Access settings via the extension toolbar icon or through `about:addons` > Auto Close Tabs > Preferences.

| Setting | Default | Description |
|---|---|---|
| Enabled | On | Enable or disable auto-closing |
| Inactivity threshold | 7 days | Close tabs not accessed for this many days |
| Check interval | 60 minutes | How often to scan for inactive tabs |
| Protect audible tabs | On | Don't close tabs playing audio |
| Protected domains | (none) | Domains to never auto-close (one per line) |

## How it works

The extension uses the browser's `tabs.lastAccessed` property, which tracks when a tab was last activated. A background alarm runs at the configured interval and closes any non-pinned tab whose `lastAccessed` time exceeds the inactivity threshold.

Tabs that are never explicitly skipped:
- Pinned tabs (including Zen Essentials)
- The active tab in each window
- The last remaining tab in any window
- Internal browser pages (`about:`, `moz-extension:`)
