import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { requireDosen } from "@/lib/api-helpers";
import { examCreateSchema } from "@/lib/validation";
import { generateUniqueExamCode } from "@/lib/exam-code";
import type { ExamRow } from "@/lib/types";

export async function GET() {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const exams = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM question q WHERE q.exam_id = e.id) as question_count,
        (SELECT COUNT(*) FROM attempt a WHERE a.exam_id = e.id AND a.status = 'submitted') as submitted_count
       FROM exam e WHERE e.dosen_id = ? ORDER BY e.created_at DESC`,
    )
    .all(auth.dosen.id);

  return NextResponse.json({ exams });
}

export async function POST(request: Request) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = examCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const id = newId();
  const code = generateUniqueExamCode();
  const now = nowIso();

  db.prepare(
    `INSERT INTO exam (id, dosen_id, title, description, code, language, duration_minutes,
      shuffle_questions, shuffle_options, allow_retake, show_result_to_student,
      status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
  ).run(
    id,
    auth.dosen.id,
    data.title,
    data.description,
    code,
    data.language,
    data.duration_minutes,
    1,
    data.shuffle_options ? 1 : 0,
    data.allow_retake ? 1 : 0,
    data.show_result_to_student ? 1 : 0,
    now,
    now,
  );

  const exam = db.prepare("SELECT * FROM exam WHERE id = ?").get(id) as ExamRow;
  return NextResponse.json({ exam }, { status: 201 });
}
