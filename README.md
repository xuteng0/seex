<p align="center">
  <img src="src/assets/seex.svg" alt="SeEx Logo" width="200" />
</p>

<h1 align="center">SeEx</h1>

<p align="center">
  <strong>Seek &amp; Export</strong> — Clipboard Event Tracker
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.5-E8656C" alt="version" />
  <img src="https://img.shields.io/badge/license-CC%20BY--NC%204.0-F4845F" alt="license" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-66BB6A" alt="platform" />
</p>

---

# About

<p align="center">
  <img src="public/imgs/nlbn.png" alt="nlbn preview" height="260" />
  <img src="public/imgs/npnp.png" alt="npnp preview" height="260" />
</p>

This is a gui bridge for [`nlbn`](https://github.com/linkyourbin/nlbn) and [`npnp`](https://github.com/linkyourbin/npnp).

<p align="center">
  <img src="public/imgs/About.png" alt="SeEx About page" width="340" />
  <img src="public/imgs/Monitor.png" alt="SeEx Monitor page" width="340" />
</p>

<p align="center">
  <img src="public/imgs/History.png" alt="SeEx History page" width="340" />
  <img src="public/imgs/Export_nlbn.png" alt="SeEx nlbn export page" width="340" />
</p>

<p align="center">
  <img src="public/imgs/Export_npnp.png" alt="SeEx npnp export page" width="340" />
  <img src="public/imgs/Language.png" alt="SeEx Language page" width="340" />
</p>

## How to use

Just install it from github release, or you can build it on your own for your own platform. Then open `seex` while you go to [`LCSC`](https://www.szlcsc.com/) to pick those components you need, and click the `复制/copy`  button, the tool `seex` will macth the id of the compoent and then you can export.

<p align="center">
  <img src="public/imgs/lcsc.png" alt="SeEx npnp export page" width="340" />
</p>

## Build from source

### Requirements

- [Node.js](https://nodejs.org/) and npm
- [Rust](https://www.rust-lang.org/tools/install)
- The system dependencies required by [Tauri v2](https://v2.tauri.app/start/prerequisites/) for your platform
- On Windows, WiX and NSIS are required when creating installer bundles

### Install dependencies

```powershell
npm ci
```

### Build the frontend only

```powershell
npm run build
```

The frontend output is written to `dist/`.

### Build the desktop app and installers

For a normal release build with signed updater artifacts, set the updater signing environment variables first:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "<private-key>"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<private-key-password>"
npm run tauri build
```

The release outputs are written under `src-tauri/target/release/`, with installers under `src-tauri/target/release/bundle/`.

For a local build without updater signing keys, disable updater artifact generation with a temporary config override:

```powershell
@'
{
  "bundle": {
    "createUpdaterArtifacts": false
  }
}
'@ | Set-Content src-tauri/local-build.tauri.conf.json

npm.cmd run tauri build -- --config src-tauri/local-build.tauri.conf.json
Remove-Item src-tauri/local-build.tauri.conf.json
```

Use `npm.cmd` on Windows if PowerShell blocks the `npm.ps1` wrapper because script execution is disabled.

## Note

`nlbn` is for `Windows`, `Macos`, `Linux`, becuase `Kicad` is built for such case. `npnp` is `Windows` only since `Altitum designer` is windows only.

## Updater

SeEx uses Tauri's signed updater against GitHub Releases. Release builds require the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; the public key is configured in `src-tauri/tauri.conf.json`.

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

Free to use, share, and adapt for non-commercial purposes with attribution.
