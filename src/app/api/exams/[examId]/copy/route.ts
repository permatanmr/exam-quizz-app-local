import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { generateUniqueExamCode } from "@/lib/exam-code";
import type { QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const source = owned.exam;
  const questions = db
    .prepare(
      "SELECT * FROM question WHERE exam_id = ? ORDER BY order_index ASC",
    )
    .all(source.id) as QuestionRow[];
  const copyId = newId();
  const code = generateUniqueExamCode();
  const now = nowIso();

  const copyExam = db.transaction(() => {
    db.prepare(
      `INSERT INTO exam (id, dosen_id, title, description, code, language,
        duration_minutes, shuffle_questions, shuffle_options, allow_retake,
        show_result_to_student, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    ).run(
      copyId,
      auth.dosen.id,
      `${source.title} (Salinan)`,
      source.description,
      code,
      source.language,
      source.duration_minutes,
      source.shuffle_questions,
      source.shuffle_options,
      source.allow_retake,
      source.show_result_to_student,
      now,
      now,
    );

    const insertQuestion = db.prepare(
      `INSERT INTO question (
        id, exam_id, question_type, text, options, correct_option_id, explanation,
        order_index, points, source, coding_language, coding_prompt,
        coding_starter_code, coding_solution_code, coding_test_cases,
        coding_expected_output_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const question of questions) {
      insertQuestion.run(
        newId(),
        copyId,
        question.question_type,
        question.text,
        question.options,
        question.correct_option_id,
        question.explanation,
        question.order_index,
        question.points,
        question.source,
        question.coding_language,
        question.coding_prompt,
        question.coding_starter_code,
        question.coding_solution_code,
        question.coding_test_cases,
        question.coding_expected_output_type,
        now,
      );
    }
  });

  copyExam();

  const exam = db.prepare("SELECT * FROM exam WHERE id = ?").get(copyId);
  return NextResponse.json({ exam }, { status: 201 });
}
