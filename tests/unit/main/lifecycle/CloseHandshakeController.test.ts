import { describe, expect, test } from "vitest";
import { CloseHandshakeController } from "@main/lifecycle/CloseHandshakeController";


describe("CloseHandshakeController", () => {
  test("deduplicates requests and ignores stale responses", () => {
    const controller = new CloseHandshakeController(() => "request-1");
    const request = controller.begin("window-close");
    expect(request?.requestId).toBe("request-1");
    expect(controller.begin("window-close")).toBeNull();
    expect(controller.respond({ requestId: "old", decision: "proceed" })).toBe("ignored");
    expect(controller.isPending()).toBe(true);
  });

  test("cancel clears pending state and allows a new request", () => {
    let sequence = 0;
    const controller = new CloseHandshakeController(() => `request-${++sequence}`);
    const first = controller.begin("window-close");
    expect(controller.respond({ requestId: first!.requestId, decision: "cancel" })).toBe("cancel");
    expect(controller.isPending()).toBe(false);
    expect(controller.begin("window-close")?.requestId).toBe("request-2");
  });

  test("proceed allows exactly the final native close", () => {
    const controller = new CloseHandshakeController(() => "request-1");
    const request = controller.begin("window-close")!;
    expect(controller.respond({ requestId: request.requestId, decision: "proceed" })).toBe("proceed");
    expect(controller.isWindowCloseAllowed()).toBe(true);
    expect(controller.begin("window-close")).toBeNull();
  });
});
