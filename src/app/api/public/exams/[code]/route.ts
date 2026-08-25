import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ExamRow } from "@/lib/types";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { code } = await params;
  const exam = db
    .prepare("SELECT * FROM exam WHERE code = ?")
    .get(code.trim().toUpperCase()) as ExamRow | undefined;

  if (!exam) {
    return NextResponse.json({ error: "Kode ujian tidak ditemukan" }, { status: 404 });
  }
  if (exam.status !== "published") {
    return NextResponse.json(
      { error: "Ujian ini belum dibuka atau sudah ditutup oleh dosen." },
      { status: 403 }
    );
  }

  const questionCount = db
    .prepare("SELECT COUNT(*) as c FROM question WHERE exam_id = ?")
    .get(exam.id) as { c: number };

  if (questionCount.c === 0) {
    return NextResponse.json(
      { error: "Ujian ini belum memiliki soal. Hubungi dosen pengampu." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      duration_minutes: exam.duration_minutes,
      question_count: questionCount.c,
      allow_retake: exam.allow_retake === 1,
    },
  });
}
