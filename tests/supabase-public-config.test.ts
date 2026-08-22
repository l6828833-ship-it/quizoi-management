import { describe, expect, it } from "vitest";

describe("Supabase public player configuration", () => {
  it("can read the published category endpoint with the configured browser-safe key", async () => {
    const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(projectUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(publishableKey).toMatch(/^sb_publishable_/);

    const response = await fetch(`${projectUrl}/rest/v1/quiz_categories?select=id&limit=1`, {
      headers: {
        apikey: publishableKey!,
        Authorization: `Bearer ${publishableKey}`,
      },
    });

    expect(response.ok).toBe(true);
  });
});
