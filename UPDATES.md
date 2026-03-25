# Publishing updates (auto-update)

The app uses **electron-updater** with **GitHub Releases** so users who installed the **NSIS installer** can get updates without you handing them a new zip every time.

**Portable `.exe`** builds do **not** receive auto-updates; only the installed NSIS version does.

---

## 1. One-time setup

### A. GitHub repository

1. Create a **public** repository on GitHub (this project expects public releases).
2. In `electron/package.json`, under `build.publish`, set:
   - `"owner"` – your GitHub username or organization name  
   - `"repo"` – the repository name  

Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME`.

### B. GitHub token for uploads

When you publish a build, `electron-builder` uploads installers to a **GitHub Release**.

1. GitHub → **Settings → Developer settings → Personal access tokens**.
2. Create a token (classic is fine) with at least:
   - **repo** (full control of private repositories) — needed to create releases and upload assets.

3. On Windows **PowerShell**, before running the release command:

   ```powershell
   $env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
   ```

   Or set a permanent user env var `GH_TOKEN` so you do not paste it every time.

**Security:** Never commit the token to git.

---

## 2. Every release

1. **Bump the version** in `electron/package.json` (semver, and it **must** be higher than the last published release), e.g. `1.0.4` → `1.0.5`.

2. From the **`electron`** folder:

   ```powershell
   cd path\to\Payday3ModManagerasdasd\electron
   $env:GH_TOKEN = "your_token_here"   # if not already set
   npm run release
   ```

   This runs `electron-builder --publish always`: it builds NSIS + portable, generates `latest.yml` (and related files), and **creates/updates a GitHub Release** with the artifacts.

3. Confirm on GitHub: **Releases** — the new version should appear with `.exe` / installer files attached.

---

## 3. What users experience

- Installed app (NSIS): on startup and about every **6 hours** while running, the app checks GitHub for a newer version. If found, it downloads in the background and can install on **quit** (default behavior). Windows may show a notification when the update is ready.
- Running from `npm start` (dev): **no** update checks (`app.isPackaged` is false).

---

## 4. Troubleshooting

- **“Cannot find latest.yml” / update never applies**  
  - Ensure you used **`npm run release`** (or `electron-builder --publish always`) so `latest.yml` is published next to the installer on the release.  
  - `owner` / `repo` in `package.json` must match the repo where releases are hosted.

- **Not using GitHub**  
  - You can switch `publish` to another provider supported by electron-builder (e.g. generic HTTP URL). See [electron-builder publish](https://www.electron.build/configuration/publish).

---

## 5. Local build without uploading

Use when you only want installers locally:

```powershell
npm run dist
```

No `GH_TOKEN` required; nothing is pushed to GitHub.
