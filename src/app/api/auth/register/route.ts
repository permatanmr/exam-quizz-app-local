import { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { countDosen, getCurrentDosen, hashPassword, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import type { DosenRow } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const isFirstRun = countDosen() === 0;
  if (!isFirstRun) {
    // Setelah akun pertama dibuat, pendaftaran hanya bisa dilakukan oleh dosen yang sudah login
    const currentDosen = await getCurrentDosen();
    if (!currentDosen) {
      return NextResponse.json(
        { error: "Pendaftaran akun baru harus dilakukan oleh dosen yang sudah login." },
        { status: 401 }
      );
    }
  }

  const { name, email, password } = parsed.data;

  const existing = db
    .prepare("SELECT id FROM dosen WHERE email = ?")
    .get(email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  const id = newId();
  const passwordHash = await hashPassword(password);
  db.prepare(
    "INSERT INTO dosen (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, email.toLowerCase(), passwordHash, nowIso());

  const row = db.prepare("SELECT * FROM dosen WHERE id = ?").get(id) as DosenRow;

  // Hanya login otomatis untuk akun pertama (bootstrap)
  if (isFirstRun) {
    await setSessionCookie({ dosenId: row.id, email: row.email, name: row.name });
  }

  return NextResponse.json({ ok: true, autoLogin: isFirstRun });
}
