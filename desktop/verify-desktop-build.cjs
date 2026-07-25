#!/usr/bin/env node
"use strict";

const { existsSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const target = process.argv[2];

if (!["--mac", "--win"].includes(target)) {
  throw new Error("Usage: node desktop/verify-desktop-build.cjs --mac|--win");
}

const requiredFiles = ["desktop/main.cjs"];
requiredFiles.push(
  target === "--mac"
    ? "build/icons/dorlabaemon.icns"
    : "build/icons/dorlabaemon.ico"
);

const missing = requiredFiles.filter((file) => !existsSync(path.join(root, file)));
if (missing.length > 0) {
  throw new Error(
    `Desktop build prerequisites are missing:\n${missing.map((file) => `  - ${file}`).join("\n")}`
  );
}

process.stdout.write(`Desktop ${target.slice(2)} build prerequisites verified.\n`);
