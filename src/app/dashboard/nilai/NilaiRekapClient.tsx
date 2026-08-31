"use client";

import { useMemo, useState } from "react";

type ExamOption = {
  id: string;
  title: string;
  code: string;
};

type StudentScoreRow = {
  student_name: string;
  student_nim: string;
  scores: Record<string, number | null>;
};

type SortMode = "name-asc" | "name-desc" | "avg-desc" | "avg-asc";

export default function NilaiRekapClient({
  exams,
  students,
}: {
  exams: ExamOption[];
  students: StudentScoreRow[];
}) {
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>(
    exams.map((exam) => exam.id),
  );
  const [sortMode, setSortMode] = useState<SortMode>("avg-desc");

  const selectedExams = useMemo(
    () => exams.filter((exam) => selectedExamIds.includes(exam.id)),
    [exams, selectedExamIds],
  );

  const toggleExam = (examId: string) => {
    setSelectedExamIds((prev) => {
      if (prev.includes(examId)) {
        const next = prev.filter((id) => id !== examId);
        return next.length > 0 ? next : prev;
      }
      return [...prev, examId];
    });
  };

  const rows = students
    .filter((student) =>
      selectedExams.some(
        (exam) =>
          student.scores[exam.id] !== null &&
          student.scores[exam.id] !== undefined,
      ),
    )
    .map((student) => {
      const scores = selectedExams.map((exam) => student.scores[exam.id]);
      const numericScores = scores.filter(
        (score): score is number => score !== null && score !== undefined,
      );

      const average =
        selectedExams.length > 0
          ? scores.reduce<number>((sum, score) => sum + (score ?? 0), 0) /
            selectedExams.length
          : null;

      const displayedAverage =
        numericScores.length === 0 && selectedExams.length > 0 ? 0 : average;

      return {
        ...student,
        scores: Object.fromEntries(
          selectedExams.map((exam) => [
            exam.id,
            student.scores[exam.id] ?? null,
          ]),
        ),
        average: displayedAverage,
      };
    })
    .sort((a, b) => {
      switch (sortMode) {
        case "name-asc":
          return a.student_name.localeCompare(b.student_name, "id", {
            sensitivity: "base",
          });
        case "name-desc":
          return b.student_name.localeCompare(a.student_name, "id", {
            sensitivity: "base",
          });
        case "avg-asc":
          return (
            (a.average ?? Number.POSITIVE_INFINITY) -
            (b.average ?? Number.POSITIVE_INFINITY)
          );
        case "avg-desc":
        default:
          return (
            (b.average ?? Number.NEGATIVE_INFINITY) -
            (a.average ?? Number.NEGATIVE_INFINITY)
          );
      }
    });

  const perExamAverage = selectedExams.map((exam) => {
    const total = rows.reduce((sum, student) => {
      const value = student.scores[exam.id];
      return sum + (value ?? 0);
    }, 0);

    return {
      examId: exam.id,
      label: `${exam.title} (${exam.code})`,
      value: rows.length > 0 ? total / rows.length : 0,
    };
  });

  const exportCsv = () => {
    if (selectedExams.length === 0 || rows.length === 0) return;

    const header = [
      "Nama Mahasiswa",
      "NIM",
      ...selectedExams.map((exam) => `${exam.title} (${exam.code})`),
      "Rata-rata",
    ];

    const csvRows = rows.map((student) => {
      const values = [
        student.student_name,
        student.student_nim,
        ...selectedExams.map((exam) => {
          const value = student.scores[exam.id];
          return value === null || value === undefined ? "" : value.toFixed(2);
        }),
        student.average === null ? "" : student.average.toFixed(2),
      ];

      return values
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });

    const summaryRow = [
      "Rata-rata ujian",
      "",
      ...perExamAverage.map((item) => item.value.toFixed(2)),
      "",
    ];

    const csvContent = [
      header.join(","),
      ...csvRows,
      summaryRow
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap-nilai-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='space-y-6'>
      <div className='card p-5'>
        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div className='flex-1'>
            <h2 className='text-lg font-semibold'>Pilih ujian</h2>
            <div className='mt-4 flex flex-wrap gap-3'>
              {exams.length === 0 ? (
                <p className='text-sm text-muted'>
                  Belum ada ujian yang bisa dipilih.
                </p>
              ) : (
                exams.map((exam) => (
                  <label
                    key={exam.id}
                    className='flex cursor-pointer items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm'>
                    <input
                      type='checkbox'
                      checked={selectedExamIds.includes(exam.id)}
                      onChange={() => toggleExam(exam.id)}
                    />
                    <span>{exam.title}</span>
                    <span className='text-muted'>({exam.code})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className='flex flex-col gap-3 md:items-end'>
            <div className='min-w-[220px]'>
              <label className='mb-1 block text-xs font-medium uppercase tracking-wide text-muted'>
                Urutkan berdasarkan
              </label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className='input w-full'>
                <option value='avg-desc'>Nilai rata-rata tertinggi</option>
                <option value='avg-asc'>Nilai rata-rata terendah</option>
                <option value='name-asc'>Nama A–Z</option>
                <option value='name-desc'>Nama Z–A</option>
              </select>
            </div>

            {rows.length > 0 && (
              <button onClick={exportCsv} className='btn btn-secondary text-sm'>
                Export Excel
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedExams.length === 0 ? (
        <div className='card p-8 text-center text-sm text-muted'>
          Pilih minimal satu ujian untuk menampilkan rekap nilai.
        </div>
      ) : (
        <div className='card overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='min-w-full border-collapse text-left text-sm'>
              <thead className='bg-surface'>
                <tr>
                  <th className='sticky left-0 z-10 border-b border-border bg-surface px-4 py-3 font-semibold text-foreground'>
                    Nama Mahasiswa
                  </th>
                  {selectedExams.map((exam) => (
                    <th
                      key={exam.id}
                      className='border-b border-border px-4 py-3 font-semibold text-foreground'>
                      <div>{exam.title}</div>
                      <div className='text-xs font-normal text-muted'>
                        {exam.code}
                      </div>
                    </th>
                  ))}
                  <th className='border-b border-border bg-surface px-4 py-3 font-semibold text-foreground'>
                    Rata-rata
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedExams.length + 2}
                      className='px-4 py-8 text-center text-muted'>
                      Belum ada data nilai submitted untuk ujian yang dipilih.
                    </td>
                  </tr>
                ) : (
                  <>
                    {rows.map((student) => (
                      <tr
                        key={student.student_nim}
                        className='border-b border-border last:border-b-0'>
                        <td className='sticky left-0 z-10 border-r border-border bg-surface px-4 py-3 align-top'>
                          <div className='font-medium'>
                            {student.student_name}
                          </div>
                          <div className='text-xs text-muted'>
                            {student.student_nim}
                          </div>
                        </td>
                        {selectedExams.map((exam) => {
                          const score = student.scores[exam.id];
                          return (
                            <td
                              key={`${student.student_nim}-${exam.id}`}
                              className='px-4 py-3 align-top'>
                              {score === null || score === undefined ? (
                                <span className='text-muted'>-</span>
                              ) : (
                                <span className='font-medium'>
                                  {score.toFixed(2)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className='border-l border-border px-4 py-3 align-top font-semibold'>
                          {student.average === null ? (
                            <span className='text-muted'>-</span>
                          ) : (
                            student.average.toFixed(2)
                          )}
                        </td>
                      </tr>
                    ))}

                    <tr className='bg-surface/70 font-semibold'>
                      <td className='border-t border-border px-4 py-3 text-muted'>
                        Rata-rata ujian
                      </td>
                      {perExamAverage.map((item) => (
                        <td
                          key={item.examId}
                          className='border-t border-border px-4 py-3 text-foreground'>
                          {item.value.toFixed(2)}
                        </td>
                      ))}
                      <td className='border-t border-border px-4 py-3 text-foreground'>
                        -
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
