"use client";

import { useState } from "react";
import type { ExamRow } from "@/lib/types";

export default function SettingsTab({
  exam,
  onChange,
}: {
  exam: ExamRow;
  onChange: (exam: ExamRow) => void;
}) {
  const [title, setTitle] = useState(exam.title);
  const [description, setDescription] = useState(exam.description);
  const [duration, setDuration] = useState(exam.duration_minutes);
  const [shuffleOptions, setShuffleOptions] = useState(
    exam.shuffle_options === 1,
  );
  const [allowRetake, setAllowRetake] = useState(exam.allow_retake === 1);
  const [showResult, setShowResult] = useState(
    exam.show_result_to_student === 1,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          duration_minutes: duration,
          shuffle_questions: true,
          shuffle_options: shuffleOptions,
          allow_retake: allowRetake,
          show_result_to_student: showResult,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan pengaturan");
        return;
      }
      onChange(data.exam);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className='card flex max-w-xl flex-col gap-4 p-6'>
      {error && (
        <div className='rounded-md bg-red-50 px-3 py-2 text-sm text-danger'>
          {error}
        </div>
      )}
      {saved && (
        <div className='rounded-md bg-green-50 px-3 py-2 text-sm text-success'>
          Pengaturan disimpan
        </div>
      )}
      <div>
        <label className='label'>Judul Ujian</label>
        <input
          className='input'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
        />
      </div>
      <div>
        <label className='label'>Deskripsi</label>
        <textarea
          className='input'
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className='label'>Durasi (menit)</label>
        <input
          type='number'
          className='input max-w-[10rem]'
          min={1}
          max={600}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </div>

      <div className='flex flex-col gap-3 border-t border-border pt-4'>
        <label className='flex items-center gap-2 text-sm'>
          <input type='checkbox' checked disabled className='h-4 w-4' />
          Acak urutan soal untuk tiap mahasiswa (selalu aktif)
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={shuffleOptions}
            onChange={(e) => setShuffleOptions(e.target.checked)}
            className='h-4 w-4'
          />
          Acak urutan pilihan jawaban untuk tiap mahasiswa
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={allowRetake}
            onChange={(e) => setAllowRetake(e.target.checked)}
            className='h-4 w-4'
          />
          Izinkan mahasiswa mengerjakan ulang (retake)
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={showResult}
            onChange={(e) => setShowResult(e.target.checked)}
            className='h-4 w-4'
          />
          Tampilkan nilai ke mahasiswa setelah submit
        </label>
      </div>

      <button
        type='submit'
        disabled={saving}
        className='btn btn-primary self-start'>
        {saving ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </form>
  );
}
