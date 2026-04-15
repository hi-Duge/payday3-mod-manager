# Release workflow

Use this so Git tags match **existing convention** (`v1.0.59`, `v1.0.60`, …) and GitHub Actions / releases stay consistent.

## Tag naming

- **Always** use a **`v` prefix**: `v1.0.60`, not `1.0.60`.
- The part after `v` must match **`version`** in `package.json` (e.g. `1.0.60`).

## Steps for each release

1. **Bump the app version** (drives `app.getVersion()` and the installer):
   - Edit **`package.json`**: `"version": "1.0.xx"`.
   - Edit **`package-lock.json`** in both places: top-level `"version"` and `packages[""].version` (or run `npm version 1.0.xx --no-git-tag-version` from the repo root).

2. **Commit** your changes (code + version files):
   ```powershell
   git add -A
   git commit -m "Release 1.0.xx"
   ```

3. **Create an annotated tag** with the `v` prefix (same commit as that release):
   ```powershell
   git tag -a v1.0.xx -m "v1.0.xx"
   ```

4. **Push** the branch and the tag:
   ```powershell
   git push origin main
   git push origin v1.0.xx
   ```
   Or: `git push origin main --tags` (pushes all local tags—use only if you intend that).

5. **Publish installers** (NSIS + portable + `latest.yml` for auto-update): see **`UPDATES.md`**. From the repo root, with `GH_TOKEN` set:
   ```powershell
   npm run release
   ```

6. **GitHub**: confirm **Releases** shows **`v1.0.xx`** with the built assets.

## Fix a wrong tag (e.g. pushed `1.0.60` without `v`)

```powershell
git push origin --delete 1.0.60
git tag -d 1.0.60
git tag -a v1.0.60 -m "v1.0.60"   # on the correct commit if needed
git push origin v1.0.60
```

## Do not commit `.bat` files

Batch files stay **local only** (e.g. `run.bat`, `build.bat`). They are covered by **`*.bat`** in `.gitignore`. Do not use `git add -f` on them. If one was committed by mistake: `git rm --cached <file.bat>`, commit, push.

## Related docs

- **`UPDATES.md`** — GitHub token, `npm run release`, auto-update behavior, optional CI workflow.
