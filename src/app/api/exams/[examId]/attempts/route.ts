import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnedExam, requireDosen } from "@/lib/api-helpers";
import type { AttemptRow } from "@/lib/types";

type Params = { params: Promise<{ examId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireDosen();
  if ("error" in auth) return auth.error;

  const { examId } = await params;
  const owned = getOwnedExam(examId, auth.dosen.id);
  if ("error" in owned) return owned.error;

  const attempts = db
    .prepare(
      `SELECT * FROM attempt WHERE exam_id = ? ORDER BY
       (submitted_at IS NULL) ASC, submitted_at DESC, started_at DESC`
    )
    .all(examId) as AttemptRow[];

  return NextResponse.json({ attempts });
}
