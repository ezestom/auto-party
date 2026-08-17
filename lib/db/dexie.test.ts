import { describe, test, expect, vi } from "vitest";

// Mock Dexie to prevent errors in Node environment without indexedDB
vi.mock("dexie", () => {
  const mockTable = {
    count: vi.fn().mockResolvedValue(0),
    bulkAdd: vi.fn().mockResolvedValue(undefined),
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        delete: vi.fn().mockResolvedValue(undefined),
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }),
  };

  return {
    default: class MockDexie {
      tracks = mockTable;
      hotCues = mockTable;
      loops = mockTable;
      constructor() {}
      version() {
        return {
          stores() {
            return {};
          },
        };
      }
    },
  };
});

describe("Dexie DB initialization tests", () => {
  test("should export a valid database instance", async () => {
    const { db } = await import("./dexie");
    expect(db).toBeDefined();
    expect(db.tracks).toBeDefined();
    expect(db.hotCues).toBeDefined();
    expect(db.loops).toBeDefined();
  });
});
