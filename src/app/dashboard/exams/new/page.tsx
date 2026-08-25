"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, duration_minutes: duration }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat ujian");
        return;
      }
      router.push(`/dashboard/exams/${data.exam.id}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-muted hover:text-primary">
        ← Kembali
      </Link>
      <div className="card mx-auto mt-4 max-w-xl p-8">
        <h1 className="text-xl font-bold">Buat Ujian Baru</h1>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
          )}
          <div>
            <label className="label">Judul Ujian</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              placeholder="UTS Basis Data 2026"
            />
          </div>
          <div>
            <label className="label">Deskripsi (opsional)</label>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Materi bab 1-5, sifat close book"
            />
          </div>
          <div>
            <label className="label">Durasi (menit)</label>
            <input
              type="number"
              className="input"
              value={duration}
              min={1}
              max={600}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary mt-2">
            {loading ? "Membuat..." : "Buat Ujian"}
          </button>
          <p className="text-xs text-muted">
            Setelah dibuat, Anda bisa menambahkan soal secara manual atau dengan AI sebelum
            mempublikasikan ujian.
          </p>
        </form>
      </div>
    </div>
  );
}
