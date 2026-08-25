"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type ExamInfo = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  question_count: number;
  allow_retake: boolean;
};

export default function UjianEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("kode")?.toUpperCase() ?? "");
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nim, setNim] = useState("");
  const [starting, setStarting] = useState(false);

  async function checkCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setExam(null);
    if (!code.trim()) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/public/exams/${code.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ujian tidak ditemukan");
        return;
      }
      setExam(data.exam);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("kode")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cek kode dari query param saat mount
      checkCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    if (!exam) return;
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/public/exams/${code.trim().toUpperCase()}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: name, student_nim: nim }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memulai ujian");
        return;
      }
      if (data.alreadySubmitted) {
        router.push(`/ujian/hasil?attempt=${data.attemptId}`);
        return;
      }
      router.push(`/ujian/kerjakan?attempt=${data.attemptId}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="card w-full max-w-md p-8">
      <h1 className="text-xl font-bold">Kerjakan Ujian</h1>
      <p className="mt-1 text-sm text-muted">Masukkan kode ujian yang diberikan dosen Anda.</p>

      <form onSubmit={checkCode} className="mt-5 flex gap-2">
        <input
          className="input font-mono uppercase tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="KODEUJI"
          maxLength={10}
          required
        />
        <button type="submit" disabled={checking} className="btn btn-secondary shrink-0">
          {checking ? "..." : "Cek"}
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {exam && (
        <div className="mt-5 border-t border-border pt-5">
          <h2 className="font-semibold">{exam.title}</h2>
          {exam.description && <p className="mt-1 text-sm text-muted">{exam.description}</p>}
          <p className="mt-2 text-sm text-muted">
            {exam.question_count} soal · {exam.duration_minutes} menit
          </p>

          <form onSubmit={onStart} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="label">Nama Lengkap</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="label">NIM</label>
              <input
                className="input"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <button type="submit" disabled={starting} className="btn btn-primary mt-1">
              {starting ? "Memulai..." : "Mulai Ujian"}
            </button>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/" className="hover:text-primary">
          ← Kembali ke beranda
        </Link>
      </p>
    </div>
  );
}
