import Link from "next/link";
import { db } from "@/lib/db";
import type { DosenRow } from "@/lib/types";

export default async function AkunPage() {
  const dosens = db
    .prepare("SELECT * FROM dosen ORDER BY created_at ASC")
    .all() as DosenRow[];

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-muted hover:text-primary">
        ← Kembali
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Akun Dosen</h1>
        <Link href="/register" className="btn btn-primary text-sm">
          + Tambah Akun Dosen
        </Link>
      </div>
      <div className="card mt-4 divide-y divide-border">
        {dosens.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <div className="font-semibold">{d.name}</div>
              <div className="text-sm text-muted">{d.email}</div>
            </div>
            <span className="text-xs text-muted">
              Bergabung {new Date(d.created_at).toLocaleDateString("id-ID")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
