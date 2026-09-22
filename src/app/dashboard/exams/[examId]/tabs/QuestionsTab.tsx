"use client";

import { useEffect, useState, useCallback } from "react";
import type { Question, QuestionOption } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function emptyOptions(n = 4): QuestionOption[] {
  return Array.from({ length: n }, (_, i) => ({ id: LETTERS[i], text: "" }));
}

type CodingTestCase = {
  input: string;
  expected_output: string;
};

type FormState = {
  type: "multiple_choice" | "coding";
  text: string;
  options: QuestionOption[];
  correct_option_id: string;
  explanation: string;
  points: number;
  language: "javascript" | "html" | "css";
  prompt: string;
  starter_code: string;
  test_cases: CodingTestCase[];
  expected_output_type: "stdout" | "html" | "css";
};

function emptyForm(): FormState {
  return {
    type: "multiple_choice",
    text: "",
    options: emptyOptions(),
    correct_option_id: "A",
    explanation: "",
    points: 1,
    language: "javascript",
    prompt: "",
    starter_code: "",
    test_cases: [{ input: "console.log(2 + 3);", expected_output: "5" }],
    expected_output_type: "stdout",
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
      type: q.question_type,
      text: q.text,
      options: q.options,
      correct_option_id: q.correct_option_id,
      explanation: q.explanation,
      points: q.points,
      language:
        (q.coding_language as "javascript" | "html" | "css") ?? "javascript",
      prompt: q.coding_prompt ?? "",
      starter_code: q.coding_starter_code ?? "",
      test_cases: q.coding_test_cases ?? [{ input: "", expected_output: "" }],
      expected_output_type:
        (q.coding_expected_output_type as "stdout" | "html" | "css") ??
        "stdout",
    });
    setError(null);
    setShowForm(true);
  }

  function updateOptionText(id: string, text: string) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o) => (o.id === id ? { ...o, text } : o)),
    }));
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
        f.correct_option_id === id
          ? (relettered[0]?.id ?? "A")
          : f.correct_option_id;
      return { ...f, options: relettered, correct_option_id: correct };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.type === "coding") {
      if (!form.prompt.trim()) {
        setError("Instruksi coding wajib diisi");
        return;
      }
      if (
        form.test_cases.some(
          (tc) => !tc.input.trim() || !tc.expected_output.trim(),
        )
      ) {
        setError("Semua test case harus memiliki input dan output yang valid");
        return;
      }
    } else if (form.options.some((o) => !o.text.trim())) {
      setError("Semua opsi harus diisi");
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/exams/${examId}/questions/${editingId}`
        : `/api/exams/${examId}/questions`;
      const payload =
        form.type === "coding"
          ? {
              type: "coding",
              text: form.text,
              explanation: form.explanation,
              points: form.points,
              language: form.language,
              prompt: form.prompt,
              starter_code: form.starter_code,
              test_cases: form.test_cases,
              expected_output_type: form.expected_output_type,
            }
          : {
              type: "multiple_choice",
              text: form.text,
              options: form.options,
              correct_option_id: form.correct_option_id,
              explanation: form.explanation,
              points: form.points,
            };

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    const res = await fetch(`/api/exams/${examId}/questions/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  async function move(index: number, dir: -1 | 1) {
    if (!questions) return;
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const reordered = [...questions];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    setQuestions(reordered);
    await fetch(`/api/exams/${examId}/questions/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((q) => q.id) }),
    });
  }

  if (questions === null) {
    return <p className='text-sm text-muted'>Memuat soal...</p>;
  }

  return (
    <div>
      <div className='flex items-center justify-between'>
        <h2 className='font-semibold'>{questions.length} Soal</h2>
        {!showForm && (
          <button onClick={startAdd} className='btn btn-primary text-sm'>
            + Tambah Soal
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className='card mt-4 flex flex-col gap-4 p-5'>
          {error && (
            <div className='rounded-md bg-red-50 px-3 py-2 text-sm text-danger'>
              {error}
            </div>
          )}
          <div>
            <label className='label'>Tipe soal</label>
            <select
              className='input'
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as "multiple_choice" | "coding",
                }))
              }>
              <option value='multiple_choice'>Pilihan ganda</option>
              <option value='coding'>Coding (JavaScript / HTML / CSS)</option>
            </select>
          </div>

          <div>
            <label className='label'>Pertanyaan</label>
            <textarea
              className='input'
              rows={3}
              required
              minLength={3}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder={
                form.type === "coding"
                  ? "Tuliskan instruksi atau tantangan coding di sini..."
                  : "Tuliskan pertanyaan di sini..."
              }
            />
          </div>

          {form.type === "coding" ? (
            <>
              <div className='grid gap-3 md:grid-cols-2'>
                <div>
                  <label className='label'>Bahasa</label>
                  <select
                    className='input'
                    value={form.language}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        language: e.target.value as
                          | "javascript"
                          | "html"
                          | "css",
                      }))
                    }>
                    <option value='javascript'>JavaScript</option>
                    <option value='html'>HTML</option>
                    <option value='css'>CSS</option>
                  </select>
                </div>
                <div>
                  <label className='label'>Output yang diharapkan</label>
                  <select
                    className='input'
                    value={form.expected_output_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expected_output_type: e.target.value as
                          | "stdout"
                          | "html"
                          | "css",
                      }))
                    }>
                    <option value='stdout'>Console / stdout</option>
                    <option value='html'>HTML</option>
                    <option value='css'>CSS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className='label'>Instruksi coding</label>
                <textarea
                  className='input'
                  rows={3}
                  value={form.prompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, prompt: e.target.value }))
                  }
                  placeholder='Contoh: Buat function tambah(a,b) yang mengembalikan jumlah dua angka.'
                />
              </div>

              <div>
                <label className='label'>Starter code (opsional)</label>
                <textarea
                  className='input font-mono text-sm'
                  rows={6}
                  value={form.starter_code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, starter_code: e.target.value }))
                  }
                  placeholder='function tambah(a, b) {\n  // tulis jawaban di sini\n}'
                />
              </div>

              <div>
                <label className='label'>Test case</label>
                <div className='flex flex-col gap-3'>
                  {form.test_cases.map((tc, index) => (
                    <div
                      key={`${tc.input}-${index}`}
                      className='rounded-lg border border-border p-3'>
                      <div className='mb-2 text-xs font-semibold uppercase text-muted'>
                        Kasus {index + 1}
                      </div>
                      <div className='grid gap-3 md:grid-cols-2'>
                        <textarea
                          className='input font-mono text-xs'
                          rows={3}
                          value={tc.input}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              test_cases: f.test_cases.map((item, i) =>
                                i === index
                                  ? { ...item, input: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder='console.log(2 + 3);'
                        />
                        <textarea
                          className='input font-mono text-xs'
                          rows={3}
                          value={tc.expected_output}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              test_cases: f.test_cases.map((item, i) =>
                                i === index
                                  ? { ...item, expected_output: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder='5'
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type='button'
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      test_cases: [
                        ...f.test_cases,
                        { input: "", expected_output: "" },
                      ],
                    }))
                  }
                  className='btn btn-secondary mt-2 px-3 py-1 text-xs'>
                  + Tambah Test Case
                </button>
              </div>
            </>
          ) : (
            <div>
              <label className='label'>
                Pilihan Jawaban (pilih radio untuk jawaban benar)
              </label>
              <div className='flex flex-col gap-2'>
                {form.options.map((opt) => (
                  <div key={opt.id} className='flex items-center gap-2'>
                    <input
                      type='radio'
                      name='correct'
                      checked={form.correct_option_id === opt.id}
                      onChange={() =>
                        setForm((f) => ({ ...f, correct_option_id: opt.id }))
                      }
                      className='h-4 w-4'
                    />
                    <span className='w-5 shrink-0 text-sm font-bold text-muted'>
                      {opt.id}.
                    </span>
                    <input
                      className='input'
                      required
                      value={opt.text}
                      onChange={(e) => updateOptionText(opt.id, e.target.value)}
                      placeholder={`Teks opsi ${opt.id}`}
                    />
                    {form.options.length > 2 && (
                      <button
                        type='button'
                        onClick={() => removeOption(opt.id)}
                        className='shrink-0 text-sm text-muted hover:text-danger'>
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.options.length < 6 && (
                <button
                  type='button'
                  onClick={addOption}
                  className='btn btn-secondary mt-2 px-3 py-1 text-xs'>
                  + Tambah Opsi
                </button>
              )}
            </div>
          )}

          <div>
            <label className='label'>Penjelasan (opsional)</label>
            <textarea
              className='input'
              rows={2}
              value={form.explanation}
              onChange={(e) =>
                setForm((f) => ({ ...f, explanation: e.target.value }))
              }
              placeholder='Penjelasan kenapa jawaban tersebut benar'
            />
          </div>

          <div className='flex gap-3'>
            <button type='submit' disabled={saving} className='btn btn-primary'>
              {saving ? "Menyimpan..." : "Simpan Soal"}
            </button>
            <button
              type='button'
              onClick={() => setShowForm(false)}
              className='btn btn-secondary'>
              Batal
            </button>
          </div>
        </form>
      )}

      {questions.length === 0 && !showForm && (
        <div className='card mt-4 p-10 text-center text-sm text-muted'>
          Belum ada soal. Tambahkan soal secara manual atau gunakan tab
          &quot;Generate AI&quot;.
        </div>
      )}

      <div className='mt-4 flex flex-col gap-3'>
        {questions.map((q, index) => (
          <div key={q.id} className='card p-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex-1'>
                <p className='font-medium'>
                  {index + 1}. {q.text}
                </p>
                {q.question_type === "coding" ? (
                  <div className='mt-2 space-y-2 text-sm text-muted'>
                    <span className='badge bg-purple-50 text-purple-700'>
                      Coding · {q.coding_language ?? "javascript"}
                    </span>
                    <p>{q.coding_prompt}</p>
                    {q.coding_test_cases && q.coding_test_cases.length > 0 && (
                      <div className='rounded-md border border-border bg-slate-50 p-2 text-xs'>
                        Test case: {q.coding_test_cases.length} item
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className='mt-2 flex flex-col gap-1'>
                    {q.options.map((opt) => (
                      <li
                        key={opt.id}
                        className={`text-sm ${
                          opt.id === q.correct_option_id
                            ? "font-semibold text-success"
                            : "text-muted"
                        }`}>
                        {opt.id}. {opt.text}
                        {opt.id === q.correct_option_id && " ✓"}
                      </li>
                    ))}
                  </ul>
                )}
                {q.explanation && (
                  <p className='mt-2 text-xs text-muted'>
                    Penjelasan: {q.explanation}
                  </p>
                )}
                {q.source === "ai" && (
                  <span className='badge mt-2 bg-blue-50 text-primary'>
                    Dibuat via AI
                  </span>
                )}
              </div>
              <div className='flex shrink-0 flex-col items-end gap-1'>
                <div className='flex gap-1'>
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className='btn btn-secondary px-2 py-1 text-xs disabled:opacity-30'
                    title='Naikkan'>
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1}
                    className='btn btn-secondary px-2 py-1 text-xs disabled:opacity-30'
                    title='Turunkan'>
                    ↓
                  </button>
                </div>
                <div className='flex gap-1'>
                  <button
                    onClick={() => startEdit(q)}
                    className='btn btn-secondary px-2 py-1 text-xs'>
                    Edit
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className='btn btn-danger px-2 py-1 text-xs'>
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
