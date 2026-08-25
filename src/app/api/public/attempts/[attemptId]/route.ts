import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rowToQuestion, questionToPublic } from "@/lib/serialize";
import { seededShuffle } from "@/lib/shuffle";
import type { AttemptRow, ExamRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ attemptId: string }> };

export async function GET(_request: Request, { params }: Params) {
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

  const exam = db
    .prepare("SELECT * FROM exam WHERE id = ?")
    .get(attempt.exam_id) as ExamRow;

  const questionRows = db
    .prepare("SELECT * FROM question WHERE exam_id = ?")
    .all(exam.id) as QuestionRow[];
  const questionMap = new Map(
    questionRows.map((q) => [q.id, rowToQuestion(q)]),
  );

  const order: string[] = JSON.parse(attempt.question_order || "[]");
  const orderedIds =
    order.length > 0
      ? order
      : seededShuffle(
          questionRows.map((q) => q.id),
          attempt.id,
        );

  if (order.length === 0) {
    db.prepare("UPDATE attempt SET question_order = ? WHERE id = ?").run(
      JSON.stringify(orderedIds),
      attempt.id,
    );
  }

  const answerRows = db
    .prepare(
      "SELECT question_id, selected_option_id FROM attempt_answer WHERE attempt_id = ?",
    )
    .all(attemptId) as {
    question_id: string;
    selected_option_id: string | null;
  }[];
  const answerMap = new Map(
    answerRows.map((a) => [a.question_id, a.selected_option_id]),
  );

  const questions = orderedIds
    .map((qid) => questionMap.get(qid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => {
      const publicQ = questionToPublic(q);
      const options =
        exam.shuffle_options === 1
          ? seededShuffle(publicQ.options, attemptId + ":" + q.id)
          : publicQ.options;
      return {
        ...publicQ,
        options,
        selected_option_id: answerMap.get(q.id) ?? null,
      };
    });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      student_name: attempt.student_name,
      student_nim: attempt.student_nim,
      started_at: attempt.started_at,
      status: attempt.status,
      score: attempt.status === "submitted" ? attempt.score : null,
      correct_count:
        attempt.status === "submitted" ? attempt.correct_count : null,
      total_questions:
        attempt.status === "submitted" ? attempt.total_questions : null,
    },
    exam: {
      title: exam.title,
      duration_minutes: exam.duration_minutes,
      show_result_to_student: exam.show_result_to_student === 1,
    },
    questions,
  });
}
