import { describe, it, expect } from "vitest";
import { maxbotSlot } from "./maxbot-slot";
const br = (h: string) => new Date(`2026-11-11T${h}-03:00`);
describe("maxbotSlot", () => {
  it("19:12:47 → 19:00:00", () => expect(maxbotSlot(br("19:12:47"))).toBe("2026-11-11 19:00:00"));
  it("19:41:05 → 19:30:00", () => expect(maxbotSlot(br("19:41:05"))).toBe("2026-11-11 19:30:00"));
  it("19:30:00 → 19:30:00", () => expect(maxbotSlot(br("19:30:00"))).toBe("2026-11-11 19:30:00"));
  it("próxima meia hora", () => expect(maxbotSlot(br("19:41:05"), 30)).toBe("2026-11-11 20:00:00"));
});
