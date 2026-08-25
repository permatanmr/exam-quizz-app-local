import Link from "next/link";
import { getCurrentDosen } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ExamRow } from "@/lib/types";

type ExamListRow = ExamRow & { question_count: number; submitted_count: number };

const statusLabel: Record<string, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-gray-100 text-gray-600" },
  published: { text: "Dipublikasikan", className: "bg-green-100 text-success" },
  closed: { text: "Ditutup", className: "bg-red-100 text-danger" },
};

export default async function DashboardPage() {
  const dosen = await getCurrentDosen();
  const exams = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM question q WHERE q.exam_id = e.id) as question_count,
        (SELECT COUNT(*) FROM attempt a WHERE a.exam_id = e.id AND a.status = 'submitted') as submitted_count
       FROM exam e WHERE e.dosen_id = ? ORDER BY e.created_at DESC`
    )
    .all(dosen!.id) as ExamListRow[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ujian Saya</h1>
          <p className="mt-1 text-sm text-muted">Kelola soal, publikasikan, dan lihat nilai.</p>
        </div>
        <Link href="/dashboard/exams/new" className="btn btn-primary">
          + Buat Ujian
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-2 p-12 text-center">
          <p className="font-semibold">Belum ada ujian</p>
          <p className="text-sm text-muted">Mulai dengan membuat ujian pertama Anda.</p>
          <Link href="/dashboard/exams/new" className="btn btn-primary mt-3">
            + Buat Ujian
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => {
            const status = statusLabel[exam.status];
            return (
              <Link
                key={exam.id}
                href={`/dashboard/exams/${exam.id}`}
                className="card flex flex-col gap-3 p-5 transition hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{exam.title}</h2>
                  <span className={`badge shrink-0 ${status.className}`}>{status.text}</span>
                </div>
                {exam.description && (
                  <p className="line-clamp-2 text-sm text-muted">{exam.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between text-sm text-muted">
                  <span>{exam.question_count} soal</span>
                  <span>{exam.submitted_count} pengumpulan</span>
                  <span className="font-mono font-semibold text-primary">{exam.code}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
