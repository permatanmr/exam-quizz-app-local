import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db";
import { evaluateCodingAnswer } from "@/lib/coding-question";
import type { AttemptRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ attemptId: string }> };

export async function POST(_request: Request, { params }: Params) {
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
    .prepare(
      "SELECT question_id, selected_option_id, answer_text FROM attempt_answer WHERE attempt_id = ?",
    )
    .all(attemptId) as {
    question_id: string;
    selected_option_id: string | null;
    answer_text: string | null;
  }[];
  const answerMap = new Map(
    answers.map((a) => [
      a.question_id,
      { selected_option_id: a.selected_option_id, answer_text: a.answer_text },
    ]),
  );

  let correctCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  const markCorrect = db.prepare(
    "UPDATE attempt_answer SET is_correct = ? WHERE attempt_id = ? AND question_id = ?",
  );

  const evaluated: { questionId: string; isCorrect: boolean }[] = [];

  for (const q of questions) {
    totalPoints += q.points;
    const answer = answerMap.get(q.id);
    const isCoding = q.question_type === "coding";
    const selected = answer?.selected_option_id ?? null;

    let isCorrect = false;
    if (isCoding) {
      const code = answer?.answer_text ?? "";
      const parsedTestCases = q.coding_test_cases
        ? JSON.parse(q.coding_test_cases)
        : [];
      const spec = {
        type: "coding" as const,
        language: (q.coding_language ?? "javascript") as
          | "javascript"
          | "html"
          | "css",
        prompt: q.coding_prompt ?? "",
        starterCode: q.coding_starter_code ?? "",
        testCases: parsedTestCases,
        expectedOutputType: (q.coding_expected_output_type ?? "stdout") as
          | "stdout"
          | "html"
          | "css",
      };
      const grading = await evaluateCodingAnswer(
        spec,
        code,
        q.coding_solution_code ?? undefined,
      );
      isCorrect = grading.isCorrect;
    } else if (selected !== undefined && selected !== null) {
      isCorrect = selected === q.correct_option_id;
    }

    if (isCorrect) {
      correctCount += 1;
      earnedPoints += q.points;
    }
    evaluated.push({ questionId: q.id, isCorrect });
  }

  const tx = db.transaction(() => {
    for (const result of evaluated) {
      if (answerMap.has(result.questionId)) {
        markCorrect.run(result.isCorrect ? 1 : 0, attemptId, result.questionId);
      }
    }

    const score =
      totalPoints > 0
        ? Math.round((earnedPoints / totalPoints) * 10000) / 100
        : 0;

    db.prepare(
      `UPDATE attempt SET status = 'submitted', submitted_at = ?, score = ?,
        total_questions = ?, correct_count = ? WHERE id = ?`,
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
