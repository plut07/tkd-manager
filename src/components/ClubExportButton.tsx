"use client";

type ExportRow = {
  competitionNumber: string | null;
  name: string;
  gender: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  category: string | null;
  nationality: string | null;
};

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ClubExportButton({ clubName, rows }: { clubName: string; rows: ExportRow[] }) {
  function download() {
    const headers = [
      "Competition No",
      "Name",
      "Gender",
      "Age",
      "Weight (kg)",
      "Height (cm)",
      "Category",
      "Nationality",
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.competitionNumber,
          r.name,
          r.gender,
          r.age,
          r.weightKg,
          r.heightCm,
          r.category,
          r.nationality,
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clubName.replace(/[^a-z0-9]+/gi, "_")}_competitors.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} className="btn-secondary !px-3 !py-1.5 text-xs">
      Export CSV
    </button>
  );
}
