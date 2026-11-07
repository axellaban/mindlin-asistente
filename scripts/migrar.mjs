// Aplica las migraciones de db/migraciones/ que falten, en orden. Corre antes del armado en cada
// publicación de Vercel (npm run build). Sin DATABASE_URL (por ejemplo en el control de GitHub),
// no hace nada.
//
// Cada archivo se aplica una sola vez y queda anotado en la tabla _migraciones. Un candado evita
// que dos publicaciones a la vez las apliquen juntas.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("migrar: no hay DATABASE_URL, no se aplica nada.");
  process.exit(0);
}

const CANDADO = 4815162342;
const carpeta = join(process.cwd(), "db", "migraciones");
const archivos = readdirSync(carpeta).filter((f) => f.endsWith(".sql")).sort();
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  await cliente.query("select pg_advisory_lock($1)", [CANDADO]);
  await cliente.query("create table if not exists _migraciones (archivo text primary key, aplicada timestamptz not null default now())");
  const { rows } = await cliente.query("select archivo from _migraciones");
  const hechas = new Set(rows.map((r) => r.archivo));
  for (const archivo of archivos) {
    if (hechas.has(archivo)) continue;
    // Cada archivo trae su begin/commit.
    await cliente.query(readFileSync(join(carpeta, archivo), "utf8"));
    await cliente.query("insert into _migraciones (archivo) values ($1)", [archivo]);
    console.log(`migrar: aplicada ${archivo}`);
  }
  console.log(`migrar: base al día (${archivos.length} migraciones).`);
} finally {
  await cliente.query("select pg_advisory_unlock($1)", [CANDADO]).catch(() => {});
  await cliente.end();
}
