import { db } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { toCsv } from "@/lib/csv";
import type { AttemptRow, ExamRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const exam = owned.exam as ExamRow;

  const attempts = db
    .prepare(
      `SELECT * FROM attempt WHERE exam_id = ? ORDER BY
       (submitted_at IS NULL) ASC, submitted_at DESC, started_at DESC`
    )
    .all(examId) as AttemptRow[];

  const rows = attempts.map((a) => [
    a.student_name,
    a.student_nim,
    a.status === "submitted" ? "Selesai" : "Belum selesai",
    a.correct_count ?? "",
    a.total_questions ?? "",
    a.score !== null ? a.score.toFixed(2) : "",
    a.started_at,
    a.submitted_at ?? "",
  ]);

  const csv = toCsv(
    ["Nama", "NIM", "Status", "Jawaban Benar", "Total Soal", "Nilai (0-100)", "Waktu Mulai", "Waktu Selesai"],
    rows
  );

  const filename = `nilai-${exam.code}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
