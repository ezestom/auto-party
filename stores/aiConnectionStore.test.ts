import { beforeEach, expect, test, vi } from "vitest";
import { useAIConnectionStore } from "./aiConnectionStore";
import { AIError } from "../lib/ai/contract";
const mock = vi.hoisted(() => ({ status: vi.fn(), unlock: vi.fn(), test: vi.fn(), logout: vi.fn() }));
vi.mock("../lib/ai/aiClient", () => ({ getAIStatus: mock.status, unlockAI: mock.unlock, testAIConnection: mock.test, logoutAI: mock.logout }));
beforeEach(() => {
  vi.resetAllMocks();
  useAIConnectionStore.setState({ status: "unknown", configured: false, authorized: false, checkedAt: null, message: "", useRemoteAI: true });
});
test("configuration alone never advertises a working provider connection", async () => {
  mock.status.mockResolvedValue({ configured: true, authorized: true, model: "test" });
  await useAIConnectionStore.getState().refresh();
  expect(useAIConnectionStore.getState().status).toBe("ready");
  expect(useAIConnectionStore.getState().checkedAt).toBeNull();
});
test("only a successful provider test marks the connection as connected", async () => {
  mock.test.mockResolvedValue({ connected: true, model: "test", checkedAt: "2026-10-22T12:00:00Z" });
  await useAIConnectionStore.getState().test();
  expect(useAIConnectionStore.getState().status).toBe("connected");
  mock.test.mockRejectedValue(new AIError("PROVIDER_AUTH"));
  await useAIConnectionStore.getState().test();
  expect(useAIConnectionStore.getState().status).toBe("error");
  expect(useAIConnectionStore.getState().checkedAt).toBeNull();
});
test("a stale status response cannot overwrite a successful login", async () => {
  let resolve!: (value: unknown) => void;
  mock.status.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValue({ configured: true, authorized: true, model: "test" });
  const pending = useAIConnectionStore.getState().refresh();
  mock.unlock.mockResolvedValue(undefined);
  expect(await useAIConnectionStore.getState().connect("invite-code")).toBe(true);
  resolve({ configured: true, authorized: false, model: "test" }); await pending;
  expect(useAIConnectionStore.getState().authorized).toBe(true);
});
test("expired access clears authorization and a local plan never claims AI success", () => {
  useAIConnectionStore.setState({ authorized: true, status: "connected" });
  useAIConnectionStore.getState().recordPlan({ source: "local", reason: "ACCESS_REQUIRED", setlist: [], djComment: "" });
  expect(useAIConnectionStore.getState().authorized).toBe(false);
  expect(useAIConnectionStore.getState().status).toBe("locked");
});
