import { describe, expect, it } from "vitest";
import { extractRuntimeResources } from "./qvac-adapter.js";

describe("extractRuntimeResources", () => {
  it("reads QVAC metric values instead of their wrapper objects", () => {
    expect(extractRuntimeResources({
      capabilities: {
        cpu: { value: { name: { value: "Local CPU" } } },
        memory: { totalBytes: { value: 1234 } },
      },
    })).toEqual({ hardware: "Local CPU", ramBytes: 1234 });
  });
});
