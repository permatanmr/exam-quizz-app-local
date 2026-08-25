"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterForm({ redirectAfter }: { redirectAfter: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mendaftar");
        return;
      }
      if (data.autoLogin) {
        router.push(redirectAfter);
        router.refresh();
      } else {
        router.push("/dashboard/akun?added=1");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      )}
      <div>
        <label className="label">Nama Lengkap</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Dr. Budi Santoso"
        />
      </div>
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="dosen@kampus.ac.id"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Minimal 6 karakter"
        />
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary mt-2">
        {loading ? "Memproses..." : "Daftar"}
      </button>
      <p className="text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Masuk
        </Link>
      </p>
    </form>
  );
}
