import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import { z } from "zod";

type Params = { params: Promise<{ examId: string }> };

const schema = z.object({ orderedIds: z.array(z.string()).min(1) });

export async function POST(request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const update = db.prepare("UPDATE question SET order_index = ? WHERE id = ? AND exam_id = ?");
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((id, index) => update.run(index, id, examId));
  });
  tx(parsed.data.orderedIds);

  return NextResponse.json({ ok: true });
}
