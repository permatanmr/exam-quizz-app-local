"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PublicQuestion = {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  order_index: number;
  selected_option_id: string | null;
};

type AttemptState = {
  id: string;
  student_name: string;
  status: "in_progress" | "submitted";
  started_at: string;
};

type ExamState = {
  title: string;
  duration_minutes: number;
  show_result_to_student: boolean;
};

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function KerjakanClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [exam, setExam] = useState<ExamState | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!attemptId) {
      setError("Sesi ujian tidak valid. Silakan mulai dari halaman kode ujian.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/public/attempts/${attemptId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sesi ujian tidak ditemukan");
        return;
      }
      if (data.attempt.status === "submitted") {
        router.replace(`/ujian/hasil?attempt=${attemptId}`);
        return;
      }
      setAttempt(data.attempt);
      setExam(data.exam);
      setQuestions(data.questions);
      const initialAnswers: Record<string, string | null> = {};
      for (const q of data.questions as PublicQuestion[]) {
        initialAnswers[q.id] = q.selected_option_id;
      }
      setAnswers(initialAnswers);

      const startedAt = new Date(data.attempt.started_at).getTime();
      const deadline = startedAt + data.exam.duration_minutes * 60 * 1000;
      setRemainingSeconds(Math.max(0, (deadline - Date.now()) / 1000));
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }, [attemptId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch data saat mount
    load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/public/attempts/${attemptId}/submit`, { method: "POST" });
      router.replace(`/ujian/hasil?attempt=${attemptId}`);
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, router, submitting]);

  useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-submit saat waktu habis
      submit();
      return;
    }
    const interval = setInterval(() => {
      setRemainingSeconds((s) => (s !== null ? s - 1 : s));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds, submit]);

  async function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    if (!attemptId) return;
    await fetch(`/api/public/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, selected_option_id: optionId }),
    });
  }

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v !== null && v !== undefined).length,
    [answers]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Memuat ujian...</p>
      </div>
    );
  }

  if (error || !attempt || !exam) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="card max-w-md p-8 text-center">
          <p className="font-semibold text-danger">{error ?? "Terjadi kesalahan"}</p>
        </div>
      </div>
    );
  }

  const isLowTime = (remainingSeconds ?? 0) < 300;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div>
            <p className="font-semibold">{exam.title}</p>
            <p className="text-xs text-muted">
              {attempt.student_name} · {answeredCount}/{questions.length} terjawab
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-lg font-bold ${isLowTime ? "text-danger" : "text-foreground"}`}
            >
              {remainingSeconds !== null ? formatTime(remainingSeconds) : "--:--"}
            </span>
            <button
              onClick={() => {
                if (confirm("Kumpulkan jawaban sekarang? Anda tidak bisa mengubah jawaban lagi.")) {
                  submit();
                }
              }}
              disabled={submitting}
              className="btn btn-primary text-sm"
            >
              {submitting ? "Mengumpulkan..." : "Kumpulkan"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
        <div className="flex flex-col gap-4">
          {questions.map((q, index) => (
            <div key={q.id} className="card p-5">
              <p className="font-medium">
                {index + 1}. {q.text}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                        selected
                          ? "border-primary bg-blue-50"
                          : "border-border hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => selectAnswer(q.id, opt.id)}
                        className="h-4 w-4"
                      />
                      <span>
                        <span className="font-semibold">{opt.id}.</span> {opt.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              if (confirm("Kumpulkan jawaban sekarang? Anda tidak bisa mengubah jawaban lagi.")) {
                submit();
              }
            }}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? "Mengumpulkan..." : "Kumpulkan Ujian"}
          </button>
        </div>
      </main>
    </div>
  );
}
