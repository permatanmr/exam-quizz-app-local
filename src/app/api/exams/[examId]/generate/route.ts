import { NextResponse } from "next/server";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { generateQuestionsSchema } from "@/lib/validation";
import { generateQuestions } from "@/lib/openai";

type Params = { params: Promise<{ examId: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const body = await request.json().catch(() => null);
  const parsed = generateQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }

  try {
    const questions = await generateQuestions({
      ...parsed.data,
      language: parsed.data.language ?? owned.exam.language,
    });
    return NextResponse.json({ questions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat soal via OpenAI";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
