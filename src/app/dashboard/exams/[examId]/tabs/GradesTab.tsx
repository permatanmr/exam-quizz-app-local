"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import type { AttemptRow, Question } from "@/lib/types";

type DetailItem = {
  question: Question;
  selected_option_id: string | null;
  is_correct: boolean;
};

export default function GradesTab({ examId, examCode }: { examId: string; examCode: string }) {
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailItem[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}/attempts`);
    const data = await res.json();
    if (res.ok) setAttempts(data.attempts);
  }, [examId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch data saat mount
    load();
  }, [load]);

  async function toggleExpand(attemptId: string) {
    if (expanded === attemptId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(attemptId);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/exams/${examId}/attempts/${attemptId}`);
      const data = await res.json();
      if (res.ok) setDetail(data.detail);
    } finally {
      setLoadingDetail(false);
    }
  }

  function startEdit(a: AttemptRow) {
    setActionError(null);
    setEditingId(a.id);
    setScoreInputs((prev) => ({
      ...prev,
      [a.id]: a.score !== null ? a.score.toString() : "0",
    }));
  }

  function cancelEdit() {
    setEditingId(null);
    setActionError(null);
  }

  async function saveScore(a: AttemptRow) {
    const raw = scoreInputs[a.id] ?? "";
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setActionError("Nilai harus berupa angka.");
      return;
    }
    if (parsed < 0 || parsed > 100) {
      setActionError("Nilai harus di antara 0 sampai 100.");
      return;
    }

    setActionError(null);
    setSavingId(a.id);
    try {
      const res = await fetch(`/api/exams/${examId}/attempts/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Gagal menyimpan nilai.");
        return;
      }

      setAttempts((prev) => {
        if (!prev) return prev;
        return prev.map((item) => (item.id === a.id ? data.attempt : item));
      });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  if (attempts === null) {
    return <p className="text-sm text-muted">Memuat nilai...</p>;
  }

  const submittedCount = attempts.filter((a) => a.status === "submitted").length;
  const avgScore =
    submittedCount > 0
      ? attempts
          .filter((a) => a.status === "submitted" && a.score !== null)
          .reduce((sum, a) => sum + (a.score ?? 0), 0) / submittedCount
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted">Total pengumpulan: </span>
            <span className="font-semibold">{submittedCount}</span>
          </div>
          {avgScore !== null && (
            <div>
              <span className="text-muted">Rata-rata nilai: </span>
              <span className="font-semibold">{avgScore.toFixed(2)}</span>
            </div>
          )}
        </div>
        <a href={`/api/exams/${examId}/attempts/export`} className="btn btn-secondary text-sm">
          Unduh CSV
        </a>
      </div>
      {actionError && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{actionError}</div>
      )}

      {attempts.length === 0 ? (
        <div className="card mt-4 p-10 text-center text-sm text-muted">
          Belum ada mahasiswa yang mengerjakan ujian ini. Bagikan kode{" "}
          <span className="font-mono font-bold">{examCode}</span> ke mahasiswa.
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">NIM</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Benar</th>
                <th className="px-4 py-2 font-medium">Nilai</th>
                <th className="px-4 py-2 font-medium">Waktu Selesai</th>
                <th className="px-4 py-2 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <Fragment key={a.id}>
                  <tr
                    onClick={() => toggleExpand(a.id)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2.5 font-medium">{a.student_name}</td>
                    <td className="px-4 py-2.5">{a.student_nim}</td>
                    <td className="px-4 py-2.5">
                      {a.status === "submitted" ? (
                        <span className="badge bg-green-100 text-success">Selesai</span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-700">
                          Sedang mengerjakan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.correct_count !== null ? `${a.correct_count}/${a.total_questions}` : "-"}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">
                      {editingId === a.id ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={scoreInputs[a.id] ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setScoreInputs((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          className="input h-9 w-28"
                        />
                      ) : a.score !== null ? (
                        a.score.toFixed(2)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {a.status === "submitted" ? (
                        editingId === a.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveScore(a)}
                              disabled={savingId === a.id}
                              className="btn btn-primary px-2 py-1 text-xs"
                            >
                              {savingId === a.id ? "Menyimpan..." : "Simpan"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingId === a.id}
                              className="btn btn-secondary px-2 py-1 text-xs"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(a)}
                            className="btn btn-secondary px-2 py-1 text-xs"
                          >
                            Edit Nilai
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-4 py-4">
                        {loadingDetail && (
                          <p className="text-sm text-muted">Memuat jawaban...</p>
                        )}
                        {detail && (
                          <div className="flex flex-col gap-3">
                            {detail.map((item, i) => (
                              <div key={item.question.id} className="text-sm">
                                <p className="font-medium">
                                  {i + 1}. {item.question.text}
                                </p>
                                <ul className="mt-1 flex flex-col gap-0.5 pl-4">
                                  {item.question.options.map((opt) => {
                                    const isCorrectAnswer =
                                      opt.id === item.question.correct_option_id;
                                    const isSelected = opt.id === item.selected_option_id;
                                    return (
                                      <li
                                        key={opt.id}
                                        className={
                                          isCorrectAnswer
                                            ? "font-semibold text-success"
                                            : isSelected
                                              ? "font-semibold text-danger"
                                              : "text-muted"
                                        }
                                      >
                                        {opt.id}. {opt.text}
                                        {isCorrectAnswer && " ✓ (kunci)"}
                                        {isSelected && !isCorrectAnswer && " ✗ (dipilih)"}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
