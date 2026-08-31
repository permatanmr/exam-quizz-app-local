import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { rowToQuestion } from "@/lib/serialize";
import { manualScoreUpdateSchema } from "@/lib/validation";
import type { AttemptRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string; attemptId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId, attemptId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const attempt = db
    .prepare("SELECT * FROM attempt WHERE id = ? AND exam_id = ?")
    .get(attemptId, examId) as AttemptRow | undefined;

  if (!attempt) {
    return NextResponse.json(
      { error: "Data ujian tidak ditemukan" },
      { status: 404 },
    );
  }

  const questions = db
    .prepare(
      "SELECT * FROM question WHERE exam_id = ? ORDER BY order_index ASC",
    )
    .all(examId) as QuestionRow[];

  const answerRows = db
    .prepare("SELECT * FROM attempt_answer WHERE attempt_id = ?")
    .all(attemptId) as {
    question_id: string;
    selected_option_id: string | null;
    is_correct: number | null;
  }[];
  const answerMap = new Map(answerRows.map((a) => [a.question_id, a]));

  const detail = questions.map((qRow) => {
    const q = rowToQuestion(qRow);
    const answer = answerMap.get(q.id);
    return {
      question: q,
      selected_option_id: answer?.selected_option_id ?? null,
      is_correct: answer?.is_correct === 1,
    };
  });

  return NextResponse.json({ attempt, detail });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId, attemptId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const attempt = db
    .prepare("SELECT * FROM attempt WHERE id = ? AND exam_id = ?")
    .get(attemptId, examId) as AttemptRow | undefined;

  if (!attempt) {
    return NextResponse.json(
      { error: "Data ujian tidak ditemukan" },
      { status: 404 },
    );
  }

  if (attempt.status !== "submitted") {
    return NextResponse.json(
      { error: "Nilai hanya dapat diubah untuk attempt yang sudah selesai." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = manualScoreUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (parsed.data.score !== undefined) {
    const score = Math.round(parsed.data.score * 100) / 100;
    updates.push("score = ?");
    values.push(score);
  }

  if (parsed.data.student_name !== undefined) {
    updates.push("student_name = ?");
    values.push(parsed.data.student_name.trim());
  }

  if (parsed.data.student_nim !== undefined) {
    updates.push("student_nim = ?");
    values.push(parsed.data.student_nim.trim());
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data yang diubah." },
      { status: 400 },
    );
  }

  db.prepare(`UPDATE attempt SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values,
    attemptId,
  );

  const updatedAttempt = db
    .prepare("SELECT * FROM attempt WHERE id = ? AND exam_id = ?")
    .get(attemptId, examId) as AttemptRow;

  return NextResponse.json({ attempt: updatedAttempt });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId, attemptId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const attempt = db
    .prepare("SELECT * FROM attempt WHERE id = ? AND exam_id = ?")
    .get(attemptId, examId) as AttemptRow | undefined;

  if (!attempt) {
    return NextResponse.json(
      { error: "Data pengerjaan tidak ditemukan" },
      { status: 404 },
    );
  }

  db.prepare("DELETE FROM attempt WHERE id = ? AND exam_id = ?").run(
    attemptId,
    examId,
  );

  return NextResponse.json({ success: true, deletedAttemptId: attemptId });
}
