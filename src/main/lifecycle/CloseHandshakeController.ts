import type { AppCloseRequest, AppCloseResponse } from "@shared/types";

export type CloseResponseResult = "ignored" | "cancel" | "proceed";

export class CloseHandshakeController {
  private pendingRequestId: string | null = null;
  private windowCloseAllowed = false;

  public constructor(private readonly createRequestId: () => string) {}

  public begin(reason: AppCloseRequest["reason"]): AppCloseRequest | null {
    if (this.windowCloseAllowed || this.pendingRequestId) return null;
    const request: AppCloseRequest = {
      requestId: this.createRequestId(),
      reason
    };
    this.pendingRequestId = request.requestId;
    return request;
  }

  public respond(response: AppCloseResponse): CloseResponseResult {
    if (response.requestId !== this.pendingRequestId) return "ignored";
    this.pendingRequestId = null;
    if (response.decision === "proceed") {
      this.windowCloseAllowed = true;
      return "proceed";
    }
    return "cancel";
  }

  public isPending(): boolean {
    return this.pendingRequestId !== null;
  }

  public isWindowCloseAllowed(): boolean {
    return this.windowCloseAllowed;
  }
}
