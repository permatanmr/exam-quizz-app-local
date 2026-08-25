import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { saveGeneratedQuestionsSchema } from "@/lib/validation";

type Params = { params: Promise<{ examId: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const body = await request.json().catch(() => null);
  const parsed = saveGeneratedQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(order_index), -1) as m FROM question WHERE exam_id = ?")
    .get(examId) as { m: number };

  const insert = db.prepare(
    `INSERT INTO question (id, exam_id, text, options, correct_option_id, explanation,
      order_index, points, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ai', ?)`
  );

  const tx = db.transaction((questions: typeof parsed.data.questions) => {
    let order = maxOrder.m + 1;
    for (const q of questions) {
      const optionIds = q.options.map((o) => o.id);
      if (!optionIds.includes(q.correct_option_id)) continue;
      insert.run(
        newId(),
        examId,
        q.text,
        JSON.stringify(q.options),
        q.correct_option_id,
        q.explanation ?? "",
        order,
        nowIso()
      );
      order += 1;
    }
    return order - (maxOrder.m + 1);
  });

  const savedCount = tx(parsed.data.questions);

  return NextResponse.json({ ok: true, savedCount });
}
