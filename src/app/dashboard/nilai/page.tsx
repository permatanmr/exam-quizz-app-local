import { getCurrentDosen } from "@/lib/auth";
import { db } from "@/lib/db";
import NilaiRekapClient from "./NilaiRekapClient";

export default async function NilaiRekapPage() {
  const dosen = await getCurrentDosen();
  const exams = db
    .prepare(
      `SELECT id, title, code
       FROM exam
       WHERE dosen_id = ?
       ORDER BY created_at DESC`,
    )
    .all(dosen!.id) as Array<{ id: string; title: string; code: string }>;

  const rows = db
    .prepare(
      `SELECT
         a.student_name,
         a.student_nim,
         a.exam_id,
         a.score
       FROM attempt a
       INNER JOIN exam e ON e.id = a.exam_id
       WHERE e.dosen_id = ? AND a.status = 'submitted'
       ORDER BY a.student_nim ASC, a.submitted_at DESC`,
    )
    .all(dosen!.id) as Array<{
    student_name: string;
    student_nim: string;
    exam_id: string;
    score: number | null;
  }>;

  const byStudent = new Map<
    string,
    {
      student_name: string;
      student_nim: string;
      scores: Record<string, number | null>;
    }
  >();

  for (const row of rows) {
    const key = row.student_nim;
    const current = byStudent.get(key) ?? {
      student_name: row.student_name,
      student_nim: row.student_nim,
      scores: {},
    };

    current.scores[row.exam_id] = row.score;
    byStudent.set(key, current);
  }

  const students = Array.from(byStudent.values()).sort((a, b) =>
    a.student_name.localeCompare(b.student_name, "id", { sensitivity: "base" }),
  );

  return (
    <div>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold'>Rekap Nilai</h1>
          <p className='mt-1 text-sm text-muted'>
            Pilih satu atau lebih ujian untuk melihat nilai per mahasiswa secara
            horizontal.
          </p>
        </div>
      </div>

      <NilaiRekapClient exams={exams} students={students} />
    </div>
  );
}
