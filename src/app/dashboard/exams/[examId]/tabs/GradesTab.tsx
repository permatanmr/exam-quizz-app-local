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
                      {a.score !== null ? a.score.toFixed(2) : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleString("id-ID") : "-"}
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-4 py-4">
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
