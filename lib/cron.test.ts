import { describe, expect, it } from "vitest";
import { esElCron } from "./cron";

describe("el cron de Vercel", () => {
  it("solo pasa con la clave exacta, y sin clave cargada no pasa nadie", () => {
    expect(esElCron("Bearer secreto", "secreto")).toBe(true);
    expect(esElCron("Bearer otro", "secreto")).toBe(false);
    expect(esElCron("secreto", "secreto")).toBe(false);
    expect(esElCron(null, "secreto")).toBe(false);
    expect(esElCron("Bearer ", "")).toBe(false);
    expect(esElCron("Bearer undefined", undefined)).toBe(false);
  });
});
