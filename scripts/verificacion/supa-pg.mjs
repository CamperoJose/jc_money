// Adaptador mínimo: implementa la parte de la API de supabase-js que usa
// `calcularEstadoPatrimonio`, contra un Postgres real. Permite ejecutar el
// cálculo de verdad, con SQL de verdad, sin depender de Supabase.
import pg from "pg";

export function clienteDesdePg(pool) {
  const construir = (tabla) => {
    const st = { tabla, cols: "*", where: [], orden: null, limite: null, embebido: null };

    const api = {
      select(cols) {
        // Separa la parte embebida "tabla(campos)" del select plano.
        const m = cols.match(/^(.*?),?\s*([a-z_]+)\((.*)\)\s*$/s);
        if (m && m[2] === "net_worth_balances") {
          st.cols = m[1].replace(/,\s*$/, "");
          st.embebido = "balances";
        } else {
          st.cols = cols;
        }
        return api;
      },
      eq(c, v) { st.where.push([c, "=", v]); return api; },
      neq(c, v) { st.where.push([c, "<>", v]); return api; },
      gt(c, v) { st.where.push([c, ">", v]); return api; },
      gte(c, v) { st.where.push([c, ">=", v]); return api; },
      lte(c, v) { st.where.push([c, "<=", v]); return api; },
      not(c, op, v) { if (op === "is" && v === null) st.where.push([c, "is not", null]); return api; },
      order(c, o) { st.orden = `${c} ${o?.ascending === false ? "desc" : "asc"}`; return api; },
      limit(n) { st.limite = n; return api; },
      insert(filas) {
        st.insertar = Array.isArray(filas) ? filas : [filas];
        return api;
      },
      delete() { st.borrar = true; return api; },
      // `upsert` con onConflict, tal como lo usa guardarAviso().
      upsert(filas, opciones) {
        st.insertar = Array.isArray(filas) ? filas : [filas];
        st.conflicto = opciones?.onConflict ?? null;
        return api;
      },
      single() { st.single = true; return api; },
      then(res, rej) { return api.ejecutar().then(res, rej); },
      async ejecutar() {
        if (st.insertar) {
          const cols = Object.keys(st.insertar[0]);
          const filas = st.insertar.map((f, i) =>
            `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(",")})`);
          const vals = st.insertar.flatMap((f) => cols.map((c) => f[c]));
          const choque = st.conflicto
            ? ` on conflict (${st.conflicto}) do update set ${cols
                .filter((c) => !st.conflicto.split(",").map((x) => x.trim()).includes(c))
                .map((c) => `${c} = excluded.${c}`)
                .join(", ")}`
            : "";
          const sql = `insert into ${st.tabla} (${cols.join(",")}) values ${filas.join(",")}${choque} returning *`;
          try {
            const r = await pool.query(sql, vals);
            return { data: st.single ? r.rows[0] : r.rows, error: null };
          } catch (e) { return { data: null, error: e }; }
        }
        const vals = [];
        const cond = st.where.map(([c, op, v]) => {
          if (op === "is not") return `${c} is not null`;
          vals.push(v);
          return `${c} ${op} $${vals.length}`;
        });
        if (st.borrar) {
          const sqlDel = `delete from ${st.tabla}` + (cond.length ? ` where ${cond.join(" and ")}` : "");
          try { await pool.query(sqlDel, vals); return { data: null, error: null }; }
          catch (e) { return { data: null, error: e }; }
        }
        const sql = `select ${st.cols === "*" ? "*" : st.cols} from ${st.tabla}` +
          (cond.length ? ` where ${cond.join(" and ")}` : "") +
          (st.orden ? ` order by ${st.orden}` : "") +
          (st.limite ? ` limit ${st.limite}` : "");
        try {
          const r = await pool.query(sql, vals);
          let data = r.rows.map((f) => {
            const o = {};
            for (const [k, v] of Object.entries(f)) {
              if (v instanceof Date) {
                // PostgREST devuelve `date` como texto y `timestamptz` en ISO.
                o[k] = /_date$/.test(k) ? v.toISOString().slice(0, 10) : v.toISOString();
              } else if (typeof v === "string" && /^-?\d+\.\d+$/.test(v)) {
                o[k] = Number(v);
              } else o[k] = v;
            }
            return o;
          });
          if (st.embebido === "balances") {
            for (const fila of data) {
              const b = await pool.query(
                `select b.account_id, b.amount, a.currency, a.is_liability
                   from net_worth_balances b join accounts a on a.id = b.account_id
                  where b.snapshot_id = $1`, [fila.id]);
              fila.net_worth_balances = b.rows.map((x) => ({
                account_id: x.account_id, amount: Number(x.amount),
                accounts: { currency: x.currency, is_liability: x.is_liability },
              }));
            }
          }
          return { data, error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },
    };
    return api;
  };
  return { from: (t) => construir(t) };
}

export async function conectar() {
  const pool = new pg.Pool({ host: "/tmp/pgtest", port: 5433, user: "postgres", database: "mymoney" });
  return { pool, db: clienteDesdePg(pool) };
}
