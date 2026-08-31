"use client";

import { useState } from "react";
import type { QuestionOption } from "@/lib/types";

type Draft = {
  text: string;
  options: QuestionOption[];
  correct_option_id: string;
  explanation: string;
  include: boolean;
};

export default function GenerateTab({ examId }: { examId: string }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<
    "mudah" | "sedang" | "sulit" | "campuran"
  >("sedang");
  const [numOptions, setNumOptions] = useState<4 | 5>(4);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setLoading(true);
    setDrafts(null);
    try {
      const res = await fetch(`/api/exams/${examId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count, difficulty, numOptions, context }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat soal");
        return;
      }
      setDrafts(
        data.questions.map(
          (q: Omit<Draft, "include">): Draft => ({ ...q, include: true }),
        ),
      );
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function updateOptionText(index: number, optionId: string, text: string) {
    setDrafts((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = {
        ...next[index],
        options: next[index].options.map((o) =>
          o.id === optionId ? { ...o, text } : o,
        ),
      };
      return next;
    });
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function saveSelected() {
    if (!drafts) return;
    const selected = drafts.filter((d) => d.include);
    if (selected.length === 0) {
      setError("Pilih minimal 1 soal untuk disimpan");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${examId}/save-generated`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: selected.map(({ include: _include, ...rest }) => {
            void _include;
            return rest;
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan soal");
        return;
      }
      setSavedMsg(
        `${data.savedCount} soal berhasil disimpan ke bank soal. Cek tab "Soal".`,
      );
      setDrafts(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className='card p-5'>
        <h2 className='font-semibold'>Generate Soal dengan OpenAI</h2>
        <p className='mt-1 text-sm text-muted'>
          Masukkan topik dan pengaturan soal, AI akan membuatkan draf soal
          pilihan ganda yang bisa Anda tinjau dan edit sebelum disimpan.
        </p>
        <form onSubmit={onGenerate} className='mt-4 flex flex-col gap-4'>
          <div>
            <label className='label'>Topik / Materi</label>
            <input
              className='input'
              required
              minLength={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='Normalisasi basis data (1NF-3NF)'
            />
          </div>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
            <div>
              <label className='label'>Jumlah Soal</label>
              <input
                type='number'
                className='input'
                min={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className='label'>Tingkat Kesulitan</label>
              <select
                className='input'
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as typeof difficulty)
                }>
                <option value='mudah'>Mudah</option>
                <option value='sedang'>Sedang</option>
                <option value='sulit'>Sulit</option>
                <option value='campuran'>Campuran</option>
              </select>
            </div>
            <div>
              <label className='label'>Jumlah Opsi</label>
              <select
                className='input'
                value={numOptions}
                onChange={(e) =>
                  setNumOptions(Number(e.target.value) as 4 | 5)
                }>
                <option value={4}>4 opsi</option>
                <option value={5}>5 opsi</option>
              </select>
            </div>
          </div>
          <div>
            <label className='label'>Materi Referensi (opsional)</label>
            <textarea
              className='input'
              rows={4}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder='Tempelkan ringkasan materi kuliah di sini agar soal lebih sesuai (opsional)'
            />
          </div>
          {error && (
            <div className='rounded-md bg-red-50 px-3 py-2 text-sm text-danger'>
              {error}
            </div>
          )}
          <button
            type='submit'
            disabled={loading}
            className='btn btn-primary self-start'>
            {loading ? "Membuat soal..." : "Generate Soal"}
          </button>
        </form>
      </div>

      {savedMsg && (
        <div className='mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-success'>
          {savedMsg}
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <div className='mt-6'>
          <div className='flex items-center justify-between'>
            <h3 className='font-semibold'>
              Draf Soal ({drafts.filter((d) => d.include).length}/
              {drafts.length} dipilih)
            </h3>
            <button
              onClick={saveSelected}
              disabled={saving}
              className='btn btn-primary text-sm'>
              {saving ? "Menyimpan..." : "Simpan Soal Terpilih"}
            </button>
          </div>
          <div className='mt-3 flex flex-col gap-3'>
            {drafts.map((d, index) => (
              <div key={index} className='card p-4'>
                <div className='flex items-start gap-3'>
                  <input
                    type='checkbox'
                    checked={d.include}
                    onChange={(e) =>
                      updateDraft(index, { include: e.target.checked })
                    }
                    className='mt-1.5 h-4 w-4'
                  />
                  <div className='flex-1'>
                    <textarea
                      className='input font-medium'
                      rows={2}
                      value={d.text}
                      onChange={(e) =>
                        updateDraft(index, { text: e.target.value })
                      }
                    />
                    <div className='mt-2 flex flex-col gap-1.5'>
                      {d.options.map((opt) => (
                        <div key={opt.id} className='flex items-center gap-2'>
                          <input
                            type='radio'
                            name={`correct-${index}`}
                            checked={d.correct_option_id === opt.id}
                            onChange={() =>
                              updateDraft(index, { correct_option_id: opt.id })
                            }
                            className='h-4 w-4'
                          />
                          <span className='w-5 shrink-0 text-sm font-bold text-muted'>
                            {opt.id}.
                          </span>
                          <input
                            className='input'
                            value={opt.text}
                            onChange={(e) =>
                              updateOptionText(index, opt.id, e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                    {d.explanation && (
                      <p className='mt-2 text-xs text-muted'>
                        Penjelasan: {d.explanation}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeDraft(index)}
                    className='shrink-0 text-sm text-muted hover:text-danger'>
                    Buang
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
