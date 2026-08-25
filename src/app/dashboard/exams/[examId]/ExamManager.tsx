"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExamRow } from "@/lib/types";
import QuestionsTab from "./tabs/QuestionsTab";
import GenerateTab from "./tabs/GenerateTab";
import GradesTab from "./tabs/GradesTab";
import SettingsTab from "./tabs/SettingsTab";

const TABS = [
  { key: "soal", label: "Soal" },
  { key: "generate", label: "Generate AI" },
  { key: "nilai", label: "Nilai" },
  { key: "pengaturan", label: "Pengaturan" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const statusLabel: Record<string, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-gray-100 text-gray-600" },
  published: { text: "Dipublikasikan", className: "bg-green-100 text-success" },
  closed: { text: "Ditutup", className: "bg-red-100 text-danger" },
};

export default function ExamManager({ exam: initialExam }: { exam: ExamRow }) {
  const router = useRouter();
  const [exam, setExam] = useState(initialExam);
  const [tab, setTab] = useState<TabKey>("soal");
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const studentUrl =
    typeof window !== "undefined" ? `${window.location.origin}/ujian?kode=${exam.code}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function togglePublish() {
    setPublishError(null);
    if (exam.status !== "published" && (questionCount ?? 0) === 0) {
      setPublishError("Tambahkan minimal 1 soal sebelum mempublikasikan ujian.");
      return;
    }
    setPublishing(true);
    const nextStatus = exam.status === "published" ? "closed" : "published";
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) setExam(data.exam);
    } finally {
      setPublishing(false);
    }
  }

  async function reopenDraft() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      const data = await res.json();
      if (res.ok) setExam(data.exam);
    } finally {
      setPublishing(false);
    }
  }

  async function deleteExam() {
    if (!confirm(`Hapus ujian "${exam.title}"? Semua soal dan nilai akan ikut terhapus.`)) return;
    const res = await fetch(`/api/exams/${exam.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const status = statusLabel[exam.status];

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-muted hover:text-primary">
        ← Semua Ujian
      </Link>

      <div className="card mt-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{exam.title}</h1>
              <span className={`badge ${status.className}`}>{status.text}</span>
            </div>
            {exam.description && (
              <p className="mt-1 max-w-xl text-sm text-muted">{exam.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Kode ujian:</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono font-bold tracking-wider">
                {exam.code}
              </span>
              <button onClick={copyLink} className="btn btn-secondary px-2 py-1 text-xs">
                {copied ? "Tersalin!" : "Salin link mahasiswa"}
              </button>
              <span className="text-muted">· {exam.duration_minutes} menit</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex gap-2">
              {exam.status === "draft" && (
                <button
                  onClick={togglePublish}
                  disabled={publishing}
                  className="btn btn-primary text-sm"
                >
                  Publikasikan
                </button>
              )}
              {exam.status === "published" && (
                <button
                  onClick={togglePublish}
                  disabled={publishing}
                  className="btn btn-secondary text-sm"
                >
                  Tutup Ujian
                </button>
              )}
              {exam.status === "closed" && (
                <button
                  onClick={reopenDraft}
                  disabled={publishing}
                  className="btn btn-secondary text-sm"
                >
                  Jadikan Draft
                </button>
              )}
              <button onClick={deleteExam} className="btn btn-danger text-sm">
                Hapus
              </button>
            </div>
            {publishError && <p className="max-w-xs text-right text-xs text-danger">{publishError}</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "soal" && (
          <QuestionsTab examId={exam.id} onCountChange={setQuestionCount} />
        )}
        {tab === "generate" && <GenerateTab examId={exam.id} />}
        {tab === "nilai" && <GradesTab examId={exam.id} examCode={exam.code} />}
        {tab === "pengaturan" && <SettingsTab exam={exam} onChange={setExam} />}
      </div>
    </div>
  );
}
