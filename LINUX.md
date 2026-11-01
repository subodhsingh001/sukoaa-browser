# Aegis Browser 0.6.2 — Linux x64 preview

For Intel/AMD 64-bit Linux desktops. ARM/Raspberry Pi, 32-bit Linux and macOS are not included. This preview is unsigned and has no automatic app updater.

## Ubuntu / Debian (preferred)

Download the `.deb`, open a terminal in its folder and run:

```sh
sudo apt install ./AegisBrowser-0.6.2-linux-amd64.deb
```

Launch Aegis Browser from the applications menu, or run `aegis-browser`. Run as your normal user. The installer configures Chromium's sandbox helper and installs an AppArmor user-namespace profile on compatible Ubuntu systems. It does not change your default browser. Remove with `sudo apt remove aegis-browser` (your user profile remains).

## Portable AppImage

```sh
chmod +x AegisBrowser-0.6.2-linux-x86_64.AppImage
./AegisBrowser-0.6.2-linux-x86_64.AppImage
```

AppImage needs working FUSE support and permission to create user namespaces for the Chromium sandbox. If FUSE is unavailable, extract with `./AegisBrowser-0.6.2-linux-x86_64.AppImage --appimage-extract`, then run `./squashfs-root/AppRun`. This does not resolve a system sandbox restriction: on Ubuntu/Debian use the installer instead. Do not run the browser as root or disable its sandbox.

## Features and limits

The Linux build uses the desktop 0.6.2 features: request filtering, private tabs (Ctrl+Shift+N), Clean test this page, cache-bypassing reload (Ctrl+Shift+R), Lite mode, native DevTools/responsive inspection, and partial support for unpacked Chromium extensions. The example in the source ZIP at `examples/page-lens` can be added from Tools & extensions. See README.md for limitations. Live YouTube ad removal is not guaranteed; Aegis has not been benchmarked as faster than other browsers.

Linux validation is documented in TEST-RESULTS.md. Headless checks do not certify graphical Wayland/X11 behavior, GPU drivers, hardware video decoding, distro installation or all extensions. A system GTK 3/NSS/audio/graphics stack is required; Alpine/musl Linux is unsupported. The Debian installer declares dependencies for apt to resolve. Your browser profile is stored in Electron's standard per-user configuration directory (normally `~/.config/aegis-browser`).

## Build from source

On x64 Linux with Node/npm and `dpkg-deb` installed:

```sh
cd desktop
npm ci
npm run dist:linux
```

The script builds AppImage via the pinned electron-builder and creates the `.deb` from the same packaged application. It reuses electron-builder's sandbox/AppArmor installation templates; signing keys and Android toolchains are not needed.
