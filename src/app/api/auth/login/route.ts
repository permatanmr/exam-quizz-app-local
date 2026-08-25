import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import type { DosenRow } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const row = db
    .prepare("SELECT * FROM dosen WHERE email = ?")
    .get(email.toLowerCase()) as DosenRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  await setSessionCookie({ dosenId: row.id, email: row.email, name: row.name });
  return NextResponse.json({ ok: true });
}
