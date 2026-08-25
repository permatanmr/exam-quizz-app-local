import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db";
import type { AttemptRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ attemptId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { attemptId } = await params;
  const attempt = db.prepare("SELECT * FROM attempt WHERE id = ?").get(attemptId) as
    | AttemptRow
    | undefined;
  if (!attempt) {
    return NextResponse.json({ error: "Sesi ujian tidak ditemukan" }, { status: 404 });
  }
  if (attempt.status === "submitted") {
    return NextResponse.json({
      ok: true,
      score: attempt.score,
      correct_count: attempt.correct_count,
      total_questions: attempt.total_questions,
    });
  }

  const questions = db
    .prepare("SELECT * FROM question WHERE exam_id = ?")
    .all(attempt.exam_id) as QuestionRow[];

  const answers = db
    .prepare("SELECT question_id, selected_option_id FROM attempt_answer WHERE attempt_id = ?")
    .all(attemptId) as { question_id: string; selected_option_id: string | null }[];
  const answerMap = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));

  let correctCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  const markCorrect = db.prepare(
    "UPDATE attempt_answer SET is_correct = ? WHERE attempt_id = ? AND question_id = ?"
  );

  const tx = db.transaction(() => {
    for (const q of questions) {
      totalPoints += q.points;
      const selected = answerMap.get(q.id);
      const isCorrect = selected !== undefined && selected === q.correct_option_id;
      if (isCorrect) {
        correctCount += 1;
        earnedPoints += q.points;
      }
      if (selected !== undefined) {
        markCorrect.run(isCorrect ? 1 : 0, attemptId, q.id);
      }
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;

    db.prepare(
      `UPDATE attempt SET status = 'submitted', submitted_at = ?, score = ?,
        total_questions = ?, correct_count = ? WHERE id = ?`
    ).run(nowIso(), score, questions.length, correctCount, attemptId);

    return score;
  });

  const score = tx();

  return NextResponse.json({
    ok: true,
    score,
    correct_count: correctCount,
    total_questions: questions.length,
  });
}
