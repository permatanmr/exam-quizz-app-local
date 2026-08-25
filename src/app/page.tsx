import Link from "next/link";
import { countDosen, getCurrentDosen } from "@/lib/auth";

export default async function Home() {
  const dosen = await getCurrentDosen();
  const hasDosen = countDosen() > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
          Aplikasi Ujian Online
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">SIUJIAN</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Buat ujian pilihan ganda secara manual atau dengan bantuan AI, bagikan kode
          ujian ke mahasiswa, dan pantau nilai secara real-time.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="card flex flex-col items-center gap-3 p-8">
            <h2 className="text-lg font-semibold">Untuk Dosen</h2>
            <p className="text-sm text-muted">
              Kelola soal ujian, generate soal dengan AI, dan lihat rekap nilai mahasiswa.
            </p>
            {dosen ? (
              <Link href="/dashboard" className="btn btn-primary mt-2 w-full">
                Buka Dashboard
              </Link>
            ) : hasDosen ? (
              <Link href="/login" className="btn btn-primary mt-2 w-full">
                Masuk sebagai Dosen
              </Link>
            ) : (
              <Link href="/register" className="btn btn-primary mt-2 w-full">
                Buat Akun Dosen Pertama
              </Link>
            )}
          </div>

          <div className="card flex flex-col items-center gap-3 p-8">
            <h2 className="text-lg font-semibold">Untuk Mahasiswa</h2>
            <p className="text-sm text-muted">
              Masukkan kode ujian yang diberikan dosen untuk mulai mengerjakan.
            </p>
            <Link href="/ujian" className="btn btn-secondary mt-2 w-full">
              Kerjakan Ujian
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
