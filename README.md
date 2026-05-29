# Sprite Forge

![Sprite Forge](/.github/images/sprite-forge.png)

**Sprite Forge** is a modern Tibia spr and dat editor and a revamp of the Object Builder, fully **vibe coded** during my limited free time, so it doesn't follow any established good practices yet.

It is currently an **experiment** focused on delivering a new and improved user experience for SPR and DAT management for Open Tibia projects.

## ⚠️ Important Warning

**Always create a backup of your SPR and DAT files before using Sprite Forge.** This application is experimental and may corrupt your files.

## About

This project leverages modern web technologies to create a powerful desktop application:
- **Tauri**: For a lightweight, secure, and fast desktop experience.
- **React & Vite**: For a dynamic and high-performance user interface.
- **Shadcn UI**: For a beautiful and accessible design system.

## Building from Source

### Prerequisites

- [Bun](https://bun.sh): package manager and JavaScript runtime
- [Rust](https://www.rust-lang.org/tools/install): stable toolchain (installed via `rustup`)
- Tauri system dependencies for your OS. Follow the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/). On Windows you mainly need the Microsoft C++ Build Tools and the WebView2 runtime.

### Setup

```bash
git clone https://github.com/Frenvius/sprite-forge.git
cd sprite-forge
bun install
```

### Development

```bash
bun run tauri:dev   # run the full desktop app (frontend + Rust backend)
bun run dev         # run the Vite frontend only (browser, no Tauri APIs)
```

### Production build

```bash
bun run tauri:build
```

The portable executable is written to `src-tauri/target/release/`, and the installer bundle to `src-tauri/target/release/bundle/`.

## Issues

If you encounter any problems, please open an issue.
