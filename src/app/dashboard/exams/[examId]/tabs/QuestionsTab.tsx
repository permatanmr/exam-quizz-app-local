"use client";

import { useEffect, useState, useCallback } from "react";
import type { Question, QuestionOption } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function emptyOptions(n = 4): QuestionOption[] {
  return Array.from({ length: n }, (_, i) => ({ id: LETTERS[i], text: "" }));
}

type FormState = {
  text: string;
  options: QuestionOption[];
  correct_option_id: string;
  explanation: string;
  points: number;
};

function emptyForm(): FormState {
  return {
    text: "",
    options: emptyOptions(),
    correct_option_id: "A",
    explanation: "",
    points: 1,
  };
}

export default function QuestionsTab({
  examId,
  onCountChange,
}: {
  examId: string;
  onCountChange: (count: number) => void;
}) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}/questions`);
    const data = await res.json();
    if (res.ok) {
      setQuestions(data.questions);
      onCountChange(data.questions.length);
    }
  }, [examId, onCountChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch data saat mount
    load();
  }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setShowForm(true);
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setForm({
      text: q.text,
      options: q.options,
      correct_option_id: q.correct_option_id,
      explanation: q.explanation,
      points: q.points,
    });
    setError(null);
    setShowForm(true);
  }

  function updateOptionText(id: string, text: string) {
    setForm((f) => ({ ...f, options: f.options.map((o) => (o.id === id ? { ...o, text } : o)) }));
  }

  function addOption() {
    setForm((f) => {
      if (f.options.length >= 6) return f;
      const nextLetter = LETTERS[f.options.length];
      return { ...f, options: [...f.options, { id: nextLetter, text: "" }] };
    });
  }

  function removeOption(id: string) {
    setForm((f) => {
      if (f.options.length <= 2) return f;
      const remaining = f.options.filter((o) => o.id !== id);
      // re-letter agar berurutan A, B, C, ...
      const relettered = remaining.map((o, i) => ({ ...o, id: LETTERS[i] }));
      const correct =
        f.correct_option_id === id ? relettered[0]?.id ?? "A" : f.correct_option_id;
      return { ...f, options: relettered, correct_option_id: correct };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.options.some((o) => !o.text.trim())) {
      setError("Semua opsi harus diisi");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/exams/${examId}/questions/${editingId}`
        : `/api/exams/${examId}/questions`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan soal");
        return;
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Hapus soal ini?")) return;
    const res = await fetch(`/api/exams/${examId}/questions/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function move(index: number, dir: -1 | 1) {
    if (!questions) return;
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const reordered = [...questions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setQuestions(reordered);
    await fetch(`/api/exams/${examId}/questions/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((q) => q.id) }),
    });
  }

  if (questions === null) {
    return <p className="text-sm text-muted">Memuat soal...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{questions.length} Soal</h2>
        {!showForm && (
          <button onClick={startAdd} className="btn btn-primary text-sm">
            + Tambah Soal
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 flex flex-col gap-4 p-5">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
          )}
          <div>
            <label className="label">Pertanyaan</label>
            <textarea
              className="input"
              rows={3}
              required
              minLength={3}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Tuliskan pertanyaan di sini..."
            />
          </div>

          <div>
            <label className="label">Pilihan Jawaban (pilih radio untuk jawaban benar)</label>
            <div className="flex flex-col gap-2">
              {form.options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correct_option_id === opt.id}
                    onChange={() => setForm((f) => ({ ...f, correct_option_id: opt.id }))}
                    className="h-4 w-4"
                  />
                  <span className="w-5 shrink-0 text-sm font-bold text-muted">{opt.id}.</span>
                  <input
                    className="input"
                    required
                    value={opt.text}
                    onChange={(e) => updateOptionText(opt.id, e.target.value)}
                    placeholder={`Teks opsi ${opt.id}`}
                  />
                  {form.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="shrink-0 text-sm text-muted hover:text-danger"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.options.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                className="btn btn-secondary mt-2 px-3 py-1 text-xs"
              >
                + Tambah Opsi
              </button>
            )}
          </div>

          <div>
            <label className="label">Penjelasan (opsional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.explanation}
              onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              placeholder="Penjelasan kenapa jawaban tersebut benar"
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Menyimpan..." : "Simpan Soal"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {questions.length === 0 && !showForm && (
        <div className="card mt-4 p-10 text-center text-sm text-muted">
          Belum ada soal. Tambahkan soal secara manual atau gunakan tab &quot;Generate AI&quot;.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {questions.map((q, index) => (
          <div key={q.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">
                  {index + 1}. {q.text}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {q.options.map((opt) => (
                    <li
                      key={opt.id}
                      className={`text-sm ${
                        opt.id === q.correct_option_id
                          ? "font-semibold text-success"
                          : "text-muted"
                      }`}
                    >
                      {opt.id}. {opt.text}
                      {opt.id === q.correct_option_id && " ✓"}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <p className="mt-2 text-xs text-muted">Penjelasan: {q.explanation}</p>
                )}
                {q.source === "ai" && (
                  <span className="badge mt-2 bg-blue-50 text-primary">Dibuat via AI</span>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="btn btn-secondary px-2 py-1 text-xs disabled:opacity-30"
                    title="Naikkan"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1}
                    className="btn btn-secondary px-2 py-1 text-xs disabled:opacity-30"
                    title="Turunkan"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(q)}
                    className="btn btn-secondary px-2 py-1 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="btn btn-danger px-2 py-1 text-xs"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
