import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { startAttemptSchema } from "@/lib/validation";
import { seededShuffle } from "@/lib/shuffle";
import type { AttemptRow, ExamRow, QuestionRow } from "@/lib/types";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  const exam = db
    .prepare("SELECT * FROM exam WHERE code = ?")
    .get(code.trim().toUpperCase()) as ExamRow | undefined;

  if (!exam) {
    return NextResponse.json(
      { error: "Kode ujian tidak ditemukan" },
      { status: 404 },
    );
  }
  if (exam.status !== "published") {
    return NextResponse.json(
      { error: "Ujian ini belum dibuka atau sudah ditutup oleh dosen." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = startAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }
  const { student_name, student_nim } = parsed.data;

  const questions = db
    .prepare(
      "SELECT * FROM question WHERE exam_id = ? ORDER BY order_index ASC",
    )
    .all(exam.id) as QuestionRow[];

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Ujian ini belum memiliki soal. Hubungi dosen pengampu." },
      { status: 403 },
    );
  }

  const existingAttempts = db
    .prepare(
      "SELECT * FROM attempt WHERE exam_id = ? AND student_nim = ? ORDER BY started_at DESC",
    )
    .all(exam.id, student_nim) as AttemptRow[];

  const inProgress = existingAttempts.find((a) => a.status === "in_progress");
  if (inProgress) {
    return NextResponse.json({ attemptId: inProgress.id, resumed: true });
  }

  const lastSubmitted = existingAttempts.find((a) => a.status === "submitted");
  if (lastSubmitted && exam.allow_retake !== 1) {
    return NextResponse.json({
      attemptId: lastSubmitted.id,
      alreadySubmitted: true,
    });
  }

  let questionIds = questions.map((q) => q.id);
  const attemptId = newId();
  // Always randomize question order per attempt to reduce answer sharing.
  questionIds = seededShuffle(questionIds, attemptId);

  db.prepare(
    `INSERT INTO attempt (id, exam_id, student_name, student_nim, started_at, status, question_order)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`,
  ).run(
    attemptId,
    exam.id,
    student_name,
    student_nim,
    nowIso(),
    JSON.stringify(questionIds),
  );

  return NextResponse.json({ attemptId, resumed: false });
}
