// Exportação de listas para CSV (abre no Excel/Sheets).
// Web: dispara download. Nativo (iOS/Android): grava no cache e abre o compartilhamento.
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Escapa uma célula para CSV (delimitador ";" — padrão pt-BR do Excel).
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(";")];
  for (const row of rows) lines.push(row.map(csvCell).join(";"));
  return lines.join("\r\n");
}

// Exporta um CSV com o nome dado. Retorna true se compartilhou/baixou.
export async function exportCsv(filename: string, csv: string): Promise<boolean> {
  const content = "\uFEFF" + csv; // BOM para acentos no Excel

  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  const file = new File(Paths.cache, filename);
  try {
    file.create({ overwrite: true });
  } catch {
    // arquivo já existe — segue para sobrescrever
  }
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Exportar CRM",
    UTI: "public.comma-separated-values-text",
  });
  return true;
}
