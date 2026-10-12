import { afterEach, describe, expect, it, vi } from "vitest";
import { handleSttCore } from "open-sse/handlers/sttCore.js";
import CODEX_PROVIDER from "open-sse/providers/registry/codex.js";

const CREDENTIALS = {
  accessToken: "fixture-codex-oauth-token",
  providerSpecificData: { chatgptAccountId: "fixture-account-id" },
};

function makeFormData() {
  const formData = new FormData();
  formData.set("file", new File([new Uint8Array([1, 2, 3])], "codex.webm", { type: "audio/webm" }));
  formData.set("language", "fa");
  return formData;
}

afterEach(() => vi.unstubAllGlobals());

describe("Codex OAuth STT", () => {
  it("registers a discoverable STT model and forwards only audio fields to Codex", async () => {
    expect(CODEX_PROVIDER.serviceKinds).toContain("stt");
    expect(CODEX_PROVIDER.models).toContainEqual(expect.objectContaining({ id: "codex-dictation", kind: "stt" }));

    const request = vi.fn(async () => new Response(JSON.stringify({ text: "سلام" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", request);

    const result = await handleSttCore({
      provider: "codex",
      model: "codex-dictation",
      formData: makeFormData(),
      credentials: CREDENTIALS,
      sttConfig: CODEX_PROVIDER.sttConfig,
    });

    expect(result.success).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://chatgpt.com/backend-api/transcribe");
    expect(options.method).toBe("POST");
    expect(options.redirect).toBe("error");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer fixture-codex-oauth-token",
      "ChatGPT-Account-Id": "fixture-account-id",
      originator: "Codex Desktop",
    });
    expect(options.body.get("file").name).toBe("codex.webm");
    expect(options.body.get("language")).toBe("fa");
    expect(options.body.has("model")).toBe(false);
    await expect(result.response.json()).resolves.toEqual({ text: "سلام" });
  });

  it("does not contact Codex without an OAuth access token", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    const result = await handleSttCore({
      provider: "codex",
      model: "codex-dictation",
      formData: makeFormData(),
      credentials: {},
      sttConfig: CODEX_PROVIDER.sttConfig,
    });

    expect(result.success).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
