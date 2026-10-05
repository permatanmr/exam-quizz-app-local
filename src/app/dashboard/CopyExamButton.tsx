"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CopyExamButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function copyExam() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/exams/${examId}/copy`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Gagal menyalin ujian");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex items-center gap-3'>
      {error && (
        <span role='alert' className='text-xs text-danger'>
          {error}
        </span>
      )}
      <button
        type='button'
        onClick={copyExam}
        disabled={loading}
        className='btn btn-secondary text-sm'
        aria-label='Salin ujian beserta soal dan jawabannya'>
        {loading ? "Menyalin..." : "Salin"}
      </button>
    </div>
  );
}
