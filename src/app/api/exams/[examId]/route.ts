import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { examUpdateSchema } from "@/lib/validation";
import type { ExamRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  return NextResponse.json({ exam: owned.exam });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const body = await request.json().catch(() => null);
  const parsed = examUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const current = owned.exam;

  db.prepare(
    `UPDATE exam SET title = ?, description = ?, duration_minutes = ?,
      shuffle_questions = ?, shuffle_options = ?, allow_retake = ?,
      show_result_to_student = ?, status = ?, updated_at = ? WHERE id = ?`,
  ).run(
    d.title ?? current.title,
    d.description ?? current.description,
    d.duration_minutes ?? current.duration_minutes,
    1,
    d.shuffle_options !== undefined
      ? d.shuffle_options
        ? 1
        : 0
      : current.shuffle_options,
    d.allow_retake !== undefined
      ? d.allow_retake
        ? 1
        : 0
      : current.allow_retake,
    d.show_result_to_student !== undefined
      ? d.show_result_to_student
        ? 1
        : 0
      : current.show_result_to_student,
    d.status ?? current.status,
    nowIso(),
    examId,
  );

  const exam = db
    .prepare("SELECT * FROM exam WHERE id = ?")
    .get(examId) as ExamRow;
  return NextResponse.json({ exam });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  db.prepare("DELETE FROM exam WHERE id = ?").run(examId);
  return NextResponse.json({ ok: true });
}
