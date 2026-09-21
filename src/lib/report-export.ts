import * as XLSX from "xlsx";
import { formatDateTime } from "./dateFormat";

export function exportExcel(filename: string, sheets: { name: string; rows: any[] }[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ "": "" }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
  });
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

// PDF via print window: supports Arabic perfectly (uses browser font rendering)
export function exportPdfPrint(opts: {
  title: string;
  subtitle?: string;
  sections: { heading: string; columns: string[]; rows: (string | number)[][] }[];
}) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const css = `
    @page { size: A4; margin: 14mm; }
    body { font-family: 'Tahoma','Segoe UI',sans-serif; direction: rtl; color:#111; }
    h1 { font-size:18px; margin:0 0 4px; }
    h2 { font-size:14px; margin:18px 0 6px; color:#0d9488; border-bottom:1px solid #ccc; padding-bottom:3px; }
    .sub { color:#666; font-size:12px; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:8px; }
    th, td { border:1px solid #ddd; padding:5px 6px; text-align:right; }
    th { background:#f0fdfa; font-weight:700; }
    tr:nth-child(even) td { background:#fafafa; }
    .foot { margin-top:14px; font-size:10px; color:#888; text-align:center; }
  `;
  const sectionsHtml = opts.sections
    .map((s) => {
      if (!s.rows.length) return `<h2>${s.heading}</h2><p style="color:#999">لا بيانات</p>`;
      const head = s.columns.map((c) => `<th>${c}</th>`).join("");
      const body = s.rows
        .map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`)
        .join("");
      return `<h2>${s.heading}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${opts.title}</title><style>${css}</style></head><body>
    <h1>${opts.title}</h1>
    ${opts.subtitle ? `<div class="sub">${opts.subtitle}</div>` : ""}
    ${sectionsHtml}
    <div class="foot">وصل — ${formatDateTime(new Date())}</div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),300);}<\/script>
  </body></html>`);
  w.document.close();
}
