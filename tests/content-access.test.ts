import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const request = { protocol: "https", headers: {} } as TrpcContext["req"];
const response = { clearCookie: () => undefined } as unknown as TrpcContext["res"];

describe("Quizio Content Studio authorization", () => {
  it("rejects unauthenticated access to the quiz management dashboard", async () => {
    const caller = appRouter.createCaller({ req: request, res: response, user: null });
    await expect(caller.quiz.admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a signed-in player attempting to manage quiz content", async () => {
    const caller = appRouter.createCaller({
      req: request,
      res: response,
      user: {
        id: 9,
        openId: "player-9",
        name: "Player",
        email: "player@example.com",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });
    await expect(caller.quiz.admin.list({ limit: 20 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
