import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { rowToQuestion } from "@/lib/serialize";
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
    return NextResponse.json({ error: "Data ujian tidak ditemukan" }, { status: 404 });
  }

  const questions = db
    .prepare("SELECT * FROM question WHERE exam_id = ? ORDER BY order_index ASC")
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
