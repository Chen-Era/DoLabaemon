import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testDirectory = mkdtempSync(join(tmpdir(), "lab-reagent-tests-"));
const storePath = join(testDirectory, "demo-store.json");

try {
  const result = spawnSync(
    process.execPath,
    ["--test", "--import", "tsx", "src/**/*.test.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LAB_REAGENT_DEMO_STORE_PATH: storePath,
      },
      stdio: "inherit",
    },
  );

  process.exitCode = result.status ?? 1;
} finally {
  rmSync(testDirectory, { recursive: true, force: true });
}
