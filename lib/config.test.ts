import { describe, expect, it } from "vitest";
import { estadoConfig, GRUPOS } from "./config";

describe("estadoConfig", () => {
  it("sin nada cargado, faltan todas", () => {
    const e = estadoConfig({});
    expect(e.listo).toBe(false);
    expect(e.faltan).toHaveLength(GRUPOS.flatMap((g) => g.variables).length);
  });

  it("acepta la variable que crea la integración de Supabase en Vercel", () => {
    const e = estadoConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
    expect(e.grupos.find((g) => g.nombre.startsWith("Base"))!.listo).toBe(true);
    expect(e.faltan).not.toContain("SUPABASE_URL");
  });

  it("un valor con solo espacios no cuenta", () => {
    expect(estadoConfig({ ANTHROPIC_API_KEY: "   " }).faltan).toContain("ANTHROPIC_API_KEY");
  });

  it("con todo cargado, está listo", () => {
    const env = Object.fromEntries(GRUPOS.flatMap((g) => g.variables).map((v) => [v.nombre, "x"]));
    expect(estadoConfig(env)).toMatchObject({ listo: true, faltan: [] });
  });
});
