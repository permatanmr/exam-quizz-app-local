import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { questionUpdateSchema } from "@/lib/validation";
import { rowToQuestion } from "@/lib/serialize";
import type { QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string; questionId: string }> };

function getQuestion(examId: string, questionId: string) {
  return db
    .prepare("SELECT * FROM question WHERE id = ? AND exam_id = ?")
    .get(questionId, examId) as QuestionRow | undefined;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId, questionId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const existing = getQuestion(examId, questionId);
  if (!existing) {
    return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const options = d.options ?? JSON.parse(existing.options);
  const correctOptionId = d.correct_option_id ?? existing.correct_option_id;
  const optionIds = options.map((o: { id: string }) => o.id);
  if (!optionIds.includes(correctOptionId)) {
    return NextResponse.json(
      { error: "Jawaban benar harus salah satu dari opsi yang ada" },
      { status: 400 }
    );
  }

  db.prepare(
    `UPDATE question SET text = ?, options = ?, correct_option_id = ?, explanation = ?, points = ?
     WHERE id = ?`
  ).run(
    d.text ?? existing.text,
    JSON.stringify(options),
    correctOptionId,
    d.explanation ?? existing.explanation,
    d.points ?? existing.points,
    questionId
  );

  const row = getQuestion(examId, questionId) as QuestionRow;
  return NextResponse.json({ question: rowToQuestion(row) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId, questionId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  db.prepare("DELETE FROM question WHERE id = ? AND exam_id = ?").run(questionId, examId);
  return NextResponse.json({ ok: true });
}
