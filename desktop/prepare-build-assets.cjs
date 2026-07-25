#!/usr/bin/env node
"use strict";

/**
 * Creates the platform-specific icon files expected by electron-builder.
 *
 * The square existing favicon is used as the temporary source for both
 * platforms.  A production release should replace it with final brand
 * artwork; generated files are intentionally not committed.
 */
const { copyFileSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const target = process.argv[2];
const iconsDirectory = path.join(root, "build", "icons");
const faviconSource = path.join(root, "src", "app", "favicon.ico");
const windowsIcon = path.join(iconsDirectory, "dorlabaemon.ico");
const macIcon = path.join(iconsDirectory, "dorlabaemon.icns");

if (!["--mac", "--win"].includes(target)) {
  throw new Error("Usage: node desktop/prepare-build-assets.cjs --mac|--win");
}

mkdirSync(iconsDirectory, { recursive: true });

if (target === "--win") {
  if (!existsSync(faviconSource)) {
    throw new Error(`Windows icon source is missing: ${faviconSource}`);
  }

  copyFileSync(faviconSource, windowsIcon);
  process.stdout.write(`Prepared ${path.relative(root, windowsIcon)}\n`);
  process.exit(0);
}

if (process.platform !== "darwin") {
  throw new Error(
    "A macOS host is required to generate the temporary .icns icon. " +
      "Run this command on macOS after checking out the repository."
  );
}

if (!existsSync(faviconSource)) {
  throw new Error(`macOS icon source is missing: ${faviconSource}`);
}

rmSync(macIcon, { force: true });
execFileSync("sips", ["-s", "format", "icns", faviconSource, "--out", macIcon], {
  stdio: "inherit",
});
process.stdout.write(`Prepared ${path.relative(root, macIcon)}\n`);
