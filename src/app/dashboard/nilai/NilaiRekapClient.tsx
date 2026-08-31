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
      const validScores = selectedExams
        .map((exam) => student.scores[exam.id])
        .filter(
          (score): score is number => score !== null && score !== undefined,
        );

      const average =
        validScores.length > 0
          ? validScores.reduce((sum, score) => sum + score, 0) /
            validScores.length
          : null;

      return {
        ...student,
        scores: Object.fromEntries(
          selectedExams.map((exam) => [
            exam.id,
            student.scores[exam.id] ?? null,
          ]),
        ),
        average,
      };
    });

  return (
    <div className='space-y-6'>
      <div className='card p-5'>
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
                  rows.map((student) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
