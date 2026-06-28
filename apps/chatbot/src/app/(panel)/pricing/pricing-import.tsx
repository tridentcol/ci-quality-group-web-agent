"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";

interface ParsedRow {
  name: string;
  category: string | null;
  unit: string;
  retailPriceCop: number;
  wholesalePriceCop: number | null;
  wholesaleThreshold: number | null;
  wholesalePrice2Cop: number | null;
  wholesaleThreshold2: number | null;
  minOrder: number | null;
  active: boolean;
}

// Mapea encabezados (es/en, sin acentos ni mayúsculas) a los campos.
const HEADER_MAP: Record<string, keyof ParsedRow> = {
  nombre: "name", name: "name",
  categoria: "category", category: "category",
  unidad: "unit", unit: "unit",
  minorista: "retailPriceCop", retail: "retailPriceCop", precio: "retailPriceCop",
  mayorista: "wholesalePriceCop", wholesale: "wholesalePriceCop",
  umbral: "wholesaleThreshold", threshold: "wholesaleThreshold",
  mayorista2: "wholesalePrice2Cop", "mayorista 2": "wholesalePrice2Cop",
  umbral2: "wholesaleThreshold2", "umbral 2": "wholesaleThreshold2",
  minimo: "minOrder", "minimo de pedido": "minOrder", min: "minOrder",
  activo: "active", active: "active",
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Parser CSV mínimo (maneja comillas, comas y saltos de línea).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === "," || c === ";") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Número estilo Colombia: "26.000" → 26000, "1.100.000" → 1100000, "26,5" → 26.5.
function parseNum(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  let t = raw.replace(/[^\d.,-]/g, "").trim();
  if (!t) return null;
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(".") && /\.\d{3}(\D|$)/.test(t)) t = t.replace(/\./g, "");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const TEMPLATE =
  "nombre,categoria,unidad,minorista,mayorista,umbral,mayorista2,umbral2,minimo,activo\n" +
  "Cobre #1,Cobre,kg,28000,26000,100,24000,1000,10,si\n" +
  "Aluminio perfil,Aluminio,kg,6500,6000,200,,,5,si\n";

export function PricingImport({
  existingNames,
  onImported,
}: {
  existingNames: Set<string>;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const table = parseCsv(String(reader.result ?? ""));
      if (table.length < 2) { setErrors(["El archivo no tiene filas de datos."]); setRows([]); return; }
      const headers = table[0].map((h) => HEADER_MAP[norm(h)]);
      if (!headers.includes("name") || !headers.includes("retailPriceCop")) {
        setErrors(["Faltan columnas obligatorias: 'nombre' y 'minorista' (precio)."]);
        setRows([]);
        return;
      }
      const errs: string[] = [];
      const parsed: ParsedRow[] = [];
      for (let i = 1; i < table.length; i++) {
        const cells = table[i];
        const get = (k: keyof ParsedRow) => {
          const idx = headers.indexOf(k);
          return idx >= 0 ? (cells[idx] ?? "").trim() : "";
        };
        const name = get("name");
        const retail = parseNum(get("retailPriceCop"));
        if (!name || retail == null) {
          errs.push(`Fila ${i + 1}: falta nombre o precio minorista.`);
          continue;
        }
        const activeRaw = norm(get("active"));
        parsed.push({
          name,
          category: get("category") || null,
          unit: get("unit") || "kg",
          retailPriceCop: retail,
          wholesalePriceCop: parseNum(get("wholesalePriceCop")),
          wholesaleThreshold: parseNum(get("wholesaleThreshold")),
          wholesalePrice2Cop: parseNum(get("wholesalePrice2Cop")),
          wholesaleThreshold2: parseNum(get("wholesaleThreshold2")),
          minOrder: parseNum(get("minOrder")),
          active: activeRaw ? !["no", "false", "0", "inactivo"].includes(activeRaw) : true,
        });
      }
      setErrors(errs);
      setRows(parsed);
    };
    reader.readAsText(file, "utf-8");
  }

  async function confirmImport() {
    if (!rows?.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/panel/pricing/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Importado: ${json.data.created} nuevos, ${json.data.updated} actualizados.`);
        setOpen(false);
        setRows(null);
        onImported();
      } else {
        toast.error(json.error?.message ?? "No se pudo importar.");
      }
    } finally {
      setBusy(false);
    }
  }

  const toCreate = rows?.filter((r) => !existingNames.has(r.name.toLowerCase())).length ?? 0;
  const toUpdate = (rows?.length ?? 0) - toCreate;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <FileSpreadsheet className="size-4" /> Importar CSV
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Importar precios desde CSV</h3>
        <button onClick={() => { setOpen(false); setRows(null); setErrors([]); }} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Columnas: <code className="rounded bg-accent px-1">nombre, categoria, unidad, minorista, mayorista, umbral, mayorista2, umbral2, minimo, activo</code>.
        Obligatorias: nombre y minorista. Si el nombre ya existe, se actualiza; si no, se crea.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
          download="plantilla-precios.csv"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Download className="size-3.5" /> Descargar plantilla
        </a>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Upload className="size-3.5" /> Elegir archivo CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-destructive">
          {errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
          {errors.length > 5 && <li>… y {errors.length - 5} más.</li>}
        </ul>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">{rows.length}</span> filas válidas —{" "}
            <span className="text-success">{toCreate} nuevas</span> ·{" "}
            <span className="text-warning">{toUpdate} a actualizar</span>.
          </p>
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-accent/50 text-muted-foreground">
                <tr><th className="px-2 py-1 text-left">Nombre</th><th className="px-2 py-1 text-left">Unidad</th><th className="px-2 py-1 text-right">Minorista</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.unit}</td>
                    <td className="px-2 py-1 text-right">{r.retailPriceCop.toLocaleString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 12 && <p className="px-2 py-1 text-xs text-muted-foreground">… y {rows.length - 12} más.</p>}
          </div>
          <button
            type="button"
            onClick={confirmImport}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Importar {rows.length} materiales
          </button>
        </div>
      )}
    </div>
  );
}
