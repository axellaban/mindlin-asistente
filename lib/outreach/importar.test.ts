import { describe, expect, it } from "vitest";
import { contarFilas, leerBase, leerFecha, proyectoDe, revisarBase, type BaseLeida, type LoQueSeSabe } from "./importar";

// Datos inventados.
const nada = (): LoQueSeSabe => ({ yaCargados: new Set(), bajas: new Set(), excluidos: new Set(), crm: new Map(), enCharla: new Set(), proyectos: [] });
const leer = (t: string) => {
  const b = leerBase(t);
  if ("error" in b) throw new Error(b.error);
  return b;
};

describe("leer la base", () => {
  it("lo pegado desde una planilla (tabulaciones), con títulos de cualquier forma", () => {
    const b = leer("Nombre\tApellido\tCelular\tConsultó por\tFecha de consulta\tAsesor\nana\tGómez\t011 15 1234-5678\tLerma\t16/11/2024\tTade\n");
    expect(b.columnas).toEqual({ nombre: "Nombre + Apellido", telefono: "Celular", proyecto: "Consultó por", fecha: "Fecha de consulta" });
    expect(b.otras).toEqual(["Asesor"]);
    expect(b.filas).toEqual([
      { fila: 2, nombre: "ana Gómez", telefono: "5491112345678", telefono_original: "011 15 1234-5678", proyecto_texto: "Lerma", fecha_consulta: "2024-11-16", origen: "", notas: "Asesor: Tade" },
    ]);
  });

  it("un CSV con comillas y punto y coma", () => {
    const b = leer('"Nombre";"WhatsApp";"Notas"\r\n"Pérez; Juan";"+54 9 221 456-7890";"dijo ""más adelante"""\r\n');
    expect(b.filas[0]).toMatchObject({ nombre: "Pérez; Juan", telefono: "5492214567890", notas: 'dijo "más adelante"' });
  });

  it("un CSV con comas", () => {
    expect(leer("name,phone\nLuis,1112345678").filas[0]).toMatchObject({ nombre: "Luis", telefono: "5491112345678" });
  });

  it("un teléfono que no se entiende queda con su motivo", () => {
    expect(leer("Nombre\tTeléfono\nLuis\t4567-8901").filas[0]).toMatchObject({ telefono: null, motivo_telefono: "falta el código de área" });
  });

  it("sin columna de teléfono, o sin filas, avisa", () => {
    expect(leerBase("Nombre\tMail\nAna\tana@ejemplo.com")).toEqual({ error: "No encontré la columna del teléfono. Tiene que llamarse «Teléfono», «Celular» o «WhatsApp»." });
    expect(leerBase("Nombre\tTeléfono\n")).toEqual({ error: "Pegá la planilla con la fila de títulos y al menos una persona." });
  });

  it("fechas", () => {
    expect(leerFecha("2024-11-16 10:30")).toBe("2024-11-16");
    expect(leerFecha("16/11/24")).toBe("2024-11-16");
    expect(leerFecha("31/02/2024")).toBeNull();
    expect(leerFecha("ayer")).toBeNull();
  });
});

describe("quién entra a la cola", () => {
  const base = (): BaseLeida =>
    leer(
      [
        "Nombre\tTeléfono\tProyecto",
        "A\t1111111111\tLerma 439",
        "B\t1111111111\t",
        "C\t4567-8901\t",
        "D\t1122222222\t",
        "E\t1133333333\t",
        "F\t1144444444\t",
        "G\t1155555555\t",
        "H\t1166666666\t",
        "I\t1177777777\t",
        "J\t1188888888\tvia 53",
      ].join("\n"),
    );
  const sabe: LoQueSeSabe = {
    yaCargados: new Set(["5491122222222"]),
    bajas: new Set(["5491133333333"]),
    excluidos: new Set(["5491144444444"]),
    crm: new Map([
      ["5491155555555", "Reserva"],
      ["5491166666666", "Descartado"],
      ["5491188888888", "Seguimiento"],
    ]),
    enCharla: new Set(["5491177777777"]),
    proyectos: [
      { id: "lerma-439", nombre: "Lerma 439", palabras_clave: ["lerma"] },
      { id: "via-53", nombre: "VIA 53", palabras_clave: ["via 53"] },
    ],
  };

  it("cada caso con su motivo", () => {
    const r = revisarBase(base().filas, sabe, { incluir_descartados: false });
    expect(r.map((f) => [f.nombre, f.estado, f.motivo, f.proyecto])).toEqual([
      ["A", "entra", "", "lerma-439"],
      ["B", "repetido", "mismo teléfono que la fila 2", null],
      ["C", "por_revisar", "falta el código de área", null],
      ["D", "repetido", "ya estaba cargado en otra base", null],
      ["E", "excluido", "pidió que no le escriban más", null],
      ["F", "excluido", "está en la lista de excluidos", null],
      ["G", "excluido", "en el CRM está en Reserva", null],
      ["H", "excluido", "en el CRM está Descartado", null],
      ["I", "excluido", "ya está hablando con Mindlin", null],
      ["J", "entra", "ya está en el CRM (Seguimiento)", "via-53"],
    ]);
    expect(contarFilas(r)).toEqual({ entra: 2, por_revisar: 1, repetido: 2, excluido: 5 });
  });

  it("los descartados entran si el lote es para reactivarlos", () => {
    const r = revisarBase(base().filas, sabe, { incluir_descartados: true });
    expect(r.find((f) => f.nombre === "H")?.estado).toBe("entra");
  });

  it("sin cruces, entran todos los que tienen teléfono", () => {
    expect(contarFilas(revisarBase(base().filas, nada(), { incluir_descartados: false }))).toEqual({ entra: 8, por_revisar: 1, repetido: 1, excluido: 0 });
  });

  it("el proyecto se reconoce solo si es uno", () => {
    const ps = sabe.proyectos;
    expect(proyectoDe("Consultó por Lerma", ps)).toBe("lerma-439");
    expect(proyectoDe("lerma o via 53", ps)).toBeNull();
    expect(proyectoDe("", ps)).toBeNull();
  });
});
