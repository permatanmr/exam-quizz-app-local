import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { saveAnswerSchema } from "@/lib/validation";
import type { AttemptRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ attemptId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { attemptId } = await params;
  const attempt = db
    .prepare("SELECT * FROM attempt WHERE id = ?")
    .get(attemptId) as AttemptRow | undefined;
  if (!attempt) {
    return NextResponse.json(
      { error: "Sesi ujian tidak ditemukan" },
      { status: 404 },
    );
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json(
      { error: "Ujian sudah selesai dikumpulkan" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = saveAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const { question_id, selected_option_id, answer_text, is_correct } =
    parsed.data;

  const question = db
    .prepare("SELECT * FROM question WHERE id = ? AND exam_id = ?")
    .get(question_id, attempt.exam_id) as QuestionRow | undefined;
  if (!question) {
    return NextResponse.json(
      { error: "Soal tidak ditemukan" },
      { status: 404 },
    );
  }

  const existing = db
    .prepare(
      "SELECT id, is_correct FROM attempt_answer WHERE attempt_id = ? AND question_id = ?",
    )
    .get(attemptId, question_id) as
    | { id: string; is_correct: number | null }
    | undefined;

  if (existing) {
    const nextIsCorrect =
      is_correct === undefined
        ? answer_text !== undefined
          ? null
          : existing.is_correct
        : is_correct === null
          ? null
          : is_correct
            ? 1
            : 0;
    db.prepare(
      `UPDATE attempt_answer SET selected_option_id = ?, answer_text = ?,
        is_correct = ?, answered_at = ? WHERE id = ?`,
    ).run(
      selected_option_id ?? null,
      answer_text ?? null,
      nextIsCorrect,
      nowIso(),
      existing.id,
    );
  } else {
    db.prepare(
      `INSERT INTO attempt_answer (id, attempt_id, question_id, selected_option_id, answer_text, is_correct, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      attemptId,
      question_id,
      selected_option_id ?? null,
      answer_text ?? null,
      is_correct === undefined || is_correct === null
        ? null
        : is_correct
          ? 1
          : 0,
      nowIso(),
    );
  }

  return NextResponse.json({ ok: true });
}
