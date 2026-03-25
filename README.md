# PAYDAY 3 Mod Manager (Electron)

Desktop app to manage .pak mods in `PAYDAY3/PAYDAY3/Content/Paks/~mods`.

## Requirements

- Node.js 18+
- npm

## Setup and run

**Option A – double-click (no PATH needed)**  
Double-click `run.bat` in the `electron` folder. It will find Node.js in default install locations (or NVM_HOME / PATH), install dependencies if needed, then start the app.

**Option B – command line**  
If `npm` is in your PATH:

```bash
cd electron
npm install
npm start
```

## Icon

Place `icon.ico` or `icon.png` in the `electron` folder (or project root). The prepack step ensures a 256x256 PNG and generates `icon.ico` for the exe/installer. Replace with your own for a custom icon.

## Build distributable

Output goes to `dist/`:

```bash
npm run pack
# or
npm run dist
```

- **Portable exe:** `dist/PAYDAY 3 Mod Manager 1.0.0.exe` – single file, no install.
- **Installer:** `dist/PAYDAY 3 Mod Manager Setup 1.0.0.exe` – NSIS installer.

### Customizing the installer

Edit the `build.nsis` section in `package.json` before building:

| Option | Description |
|--------|-------------|
| `oneClick` | `true` = no install path choice; `false` = user picks folder |
| `allowToChangeInstallationDirectory` | Let user change install path |
| `createDesktopShortcut` | Create desktop shortcut |
| `createStartMenuShortcut` | Create Start menu shortcut |
| `shortcutName` | Name of the shortcut (e.g. "PAYDAY 3 Mod Manager") |
| `menuCategory` | Start menu folder name |
| `uninstallDisplayName` | Name shown in Add/Remove Programs |
| `installerIcon` / `uninstallerIcon` | Path to .ico for installer/uninstaller window |

## Features

- Set mods directory (game root or ~mods folder)
- List mods (enabled / disabled via .pak vs .pak.disabled)
- Sort by date added (newest/oldest) or name (A-Z / Z-A)
- Enable/disable mods with a toggle
- Add .pak files or archives (.zip, .7z, .rar); .pak files are extracted and can be selected when multiple
- Duplicate mod name: choose keep existing or replace
- Delete mod with confirmation
- Drag and drop .pak or archives onto the window
- Open mods folder in Explorer, Launch game (Steam)
- Settings: Dark/Light theme, Discord Rich Presence (on/off, custom description)
- Discord presence auto-pauses when PAYDAY 3 is running
- Config and metadata stored in AppData (e.g. `%APPDATA%\payday3-mod-manager` or your Electron userData)

## Config files (in AppData)

- `mods_dir.txt` – mods folder path
- `theme.txt` – `dark` or `light`
- `sort.txt` – sort key (e.g. `date_newest`)
- `discord_presence_enabled.txt` – `1` or `0`
- `discord_description.txt` – custom presence line (max 128 chars)
- `mod_metadata.json` – “date added” per mod for sorting
