import { NextResponse } from "next/server";
import { db } from "./db";
import { getCurrentDosen } from "./auth";
import type { DosenRow, ExamRow } from "./types";

export async function requireDosen(): Promise<
  { dosen: DosenRow } | { error: NextResponse }
> {
  const dosen = await getCurrentDosen();
  if (!dosen) {
    return { error: NextResponse.json({ error: "Belum login" }, { status: 401 }) };
  }
  return { dosen };
}

export function getOwnedExam(
  examId: string,
  dosenId: string
): { exam: ExamRow } | { error: NextResponse } {
  const exam = db.prepare("SELECT * FROM exam WHERE id = ?").get(examId) as
    | ExamRow
    | undefined;
  if (!exam) {
    return { error: NextResponse.json({ error: "Ujian tidak ditemukan" }, { status: 404 }) };
  }
  if (exam.dosen_id !== dosenId) {
    return { error: NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 }) };
  }
  return { exam };
}
