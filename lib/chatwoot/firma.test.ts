import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaValida, firmar } from "./firma";

const cuerpo = JSON.stringify({ event: "message_created", content: "Hola" });
const ahora = Date.parse("2026-11-07T21:00:00Z");
const hora = ahora / 1000;

describe("firmaValida", () => {
  it("acepta la firma de Chatwoot (sha256 de «hora.cuerpo» con la clave del bot)", () => {
    const firma = `sha256=${createHmac("sha256", "clave-del-bot").update(`${hora}.${cuerpo}`).digest("hex")}`;
    expect(firmaValida(cuerpo, { hora: String(hora), firma }, "clave-del-bot", ahora)).toBe(true);
  });

  it("rechaza otra clave, un cuerpo cambiado o una firma que falta", () => {
    const f = firmar(cuerpo, "clave-del-bot", hora);
    expect(firmaValida(cuerpo, f, "otra", ahora)).toBe(false);
    expect(firmaValida(cuerpo + " ", f, "clave-del-bot", ahora)).toBe(false);
    expect(firmaValida(cuerpo, { hora: f.hora, firma: null }, "clave-del-bot", ahora)).toBe(false);
    expect(firmaValida(cuerpo, f, "", ahora)).toBe(false);
  });

  it("rechaza un aviso viejo (alguien que lo repite)", () => {
    const f = firmar(cuerpo, "k", hora - 301);
    expect(firmaValida(cuerpo, f, "k", ahora)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, "k", hora - 299), "k", ahora)).toBe(true);
  });
});
