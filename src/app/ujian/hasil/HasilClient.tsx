"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type AttemptResult = {
  student_name: string;
  status: "in_progress" | "submitted";
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
};

export default function HasilClient() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [showResult, setShowResult] = useState(true);

  useEffect(() => {
    if (!attemptId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- validasi param saat mount
      setError("Sesi ujian tidak valid.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/public/attempts/${attemptId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Data tidak ditemukan");
          return;
        }
        setAttempt(data.attempt);
        setExamTitle(data.exam.title);
        setShowResult(data.exam.show_result_to_student);
      } catch {
        setError("Terjadi kesalahan jaringan");
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Memuat hasil...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="card max-w-md p-8 text-center">
          <p className="font-semibold text-danger">{error ?? "Terjadi kesalahan"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Ujian Terkumpul
        </p>
        <h1 className="mt-2 text-xl font-bold">{examTitle}</h1>
        <p className="mt-1 text-sm text-muted">Terima kasih, {attempt.student_name}.</p>

        {attempt.status === "submitted" && showResult ? (
          <div className="mt-6">
            <p className="text-5xl font-bold text-primary">{attempt.score?.toFixed(0)}</p>
            <p className="mt-1 text-sm text-muted">
              {attempt.correct_count} dari {attempt.total_questions} jawaban benar
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Jawaban Anda telah tersimpan. Nilai akan diumumkan oleh dosen pengampu.
          </p>
        )}

        <Link href="/" className="btn btn-secondary mt-8 w-full">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
