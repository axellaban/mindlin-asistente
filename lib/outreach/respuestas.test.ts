import { describe, expect, it } from "vitest";
import { clasificarRespuesta } from "./respuestas";

describe("qué contestó", () => {
  it.each([
    ["Gracias por comunicarte con Inmobiliaria Ejemplo. En breve te respondemos.", "automatica"],
    ["¡Hola! Bienvenido a Estudio Ejemplo", "automatica"],
    ["Nuestro horario de atención es de 9 a 18", "automatica"],
    ["Esta empresa usa un servicio seguro de Meta para administrar este chat", "automatica"],
    ["No me escriban más", "baja"],
    ["dame de baja por favor", "baja"],
    ["Número equivocado", "equivocado"],
    ["no soy yo, te equivocaste", "equivocado"],
    ["No, gracias!", "no"],
    ["no", "no"],
    ["Ya compré, gracias", "no"],
    ["no estoy buscando por ahora", "no"],
    ["Hola! Sí, sigo buscando un 2 ambientes", "respuesta"],
    ["¿Qué precio tiene?", "respuesta"],
    ["no sé, contame más", "respuesta"],
    ["", "respuesta"],
  ])("«%s» → %s", (texto, esperado) => {
    expect(clasificarRespuesta(texto)).toBe(esperado);
  });
});
