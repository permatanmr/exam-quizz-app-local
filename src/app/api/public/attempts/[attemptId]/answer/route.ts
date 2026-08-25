import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { saveAnswerSchema } from "@/lib/validation";
import type { AttemptRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ attemptId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { attemptId } = await params;
  const attempt = db.prepare("SELECT * FROM attempt WHERE id = ?").get(attemptId) as
    | AttemptRow
    | undefined;
  if (!attempt) {
    return NextResponse.json({ error: "Sesi ujian tidak ditemukan" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Ujian sudah selesai dikumpulkan" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = saveAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const { question_id, selected_option_id } = parsed.data;

  const question = db
    .prepare("SELECT * FROM question WHERE id = ? AND exam_id = ?")
    .get(question_id, attempt.exam_id) as QuestionRow | undefined;
  if (!question) {
    return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  }

  const existing = db
    .prepare("SELECT id FROM attempt_answer WHERE attempt_id = ? AND question_id = ?")
    .get(attemptId, question_id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE attempt_answer SET selected_option_id = ?, answered_at = ? WHERE id = ?"
    ).run(selected_option_id, nowIso(), existing.id);
  } else {
    db.prepare(
      `INSERT INTO attempt_answer (id, attempt_id, question_id, selected_option_id, answered_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(newId(), attemptId, question_id, selected_option_id, nowIso());
  }

  return NextResponse.json({ ok: true });
}
