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

## Build Walkthrough

### Prerequisites

Install the following tools before building Sprite Forge:

- **(Node.js)[https://nodejs.org/en]**
- **(Bun)[https://bun.sh/]**
- **(Rust)[https://rustup.rs/]**

For Windows builds, install the Microsoft C++ Build Tools through Visual Studio Installer and include the Windows SDK. For other operating systems, follow the Tauri prerequisites guide: https://tauri.app/start/prerequisites/

### 1. Install dependencies

```bash
bun install
```

### 2. Run the app in development

```bash
bun tauri:dev
```

This starts the Vite dev server on `http://localhost:8080` and launches the Tauri desktop window.

### 3. Build the web frontend only

```bash
bun build
```

The compiled frontend is written to `dist/`. This is useful for checking the React/Vite build without packaging the desktop app.

### 4. Build the desktop app

```bash
bun tauri:build
```

Tauri packages the application using the configuration in `src-tauri/tauri.conf.json`. On Windows, the configured bundle target is an NSIS installer.

After the build completes, look for generated files under:

```text
src-tauri/target/release/sprite-forge.exe
```

## Issues

If you encounter any problems, please open an issue.