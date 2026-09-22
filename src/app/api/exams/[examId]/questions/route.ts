import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { questionCreateSchema } from "@/lib/validation";
import { rowToQuestion } from "@/lib/serialize";
import type { QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const rows = db
    .prepare(
      "SELECT * FROM question WHERE exam_id = ? ORDER BY order_index ASC",
    )
    .all(examId) as QuestionRow[];

  return NextResponse.json({ questions: rows.map(rowToQuestion) });
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const body = await request.json().catch(() => null);
  const parsed = questionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const maxOrder = db
    .prepare(
      "SELECT COALESCE(MAX(order_index), -1) as m FROM question WHERE exam_id = ?",
    )
    .get(examId) as { m: number };

  const id = newId();

  if (data.type === "coding") {
    db.prepare(
      `INSERT INTO question (
        id, exam_id, question_type, text, options, correct_option_id, explanation,
        order_index, points, source, coding_language, coding_prompt, coding_starter_code,
        coding_test_cases, coding_expected_output_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      examId,
      "coding",
      data.text ?? "",
      JSON.stringify([]),
      "",
      data.explanation,
      maxOrder.m + 1,
      data.points,
      data.language,
      data.prompt,
      data.starter_code,
      JSON.stringify(data.test_cases),
      data.expected_output_type,
      nowIso(),
    );
  } else {
    const optionIds = data.options.map((o) => o.id);
    if (!optionIds.includes(data.correct_option_id)) {
      return NextResponse.json(
        { error: "Jawaban benar harus salah satu dari opsi yang ada" },
        { status: 400 },
      );
    }

    db.prepare(
      `INSERT INTO question (
        id, exam_id, question_type, text, options, correct_option_id, explanation,
        order_index, points, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
    ).run(
      id,
      examId,
      "multiple_choice",
      data.text,
      JSON.stringify(data.options),
      data.correct_option_id,
      data.explanation,
      maxOrder.m + 1,
      data.points,
      nowIso(),
    );
  }

  const row = db
    .prepare("SELECT * FROM question WHERE id = ?")
    .get(id) as QuestionRow;
  return NextResponse.json({ question: rowToQuestion(row) }, { status: 201 });
}
