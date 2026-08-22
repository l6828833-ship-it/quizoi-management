import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Expo build account", () => {
  it("authenticates the configured token through the official Expo CLI", () => {
    expect(process.env.EXPO_TOKEN).toBeTruthy();

    const output = execFileSync(
      "npx",
      ["eas-cli@latest", "whoami", "--non-interactive"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    expect(output).toContain("ayoomen");
  }, 60_000);
});
