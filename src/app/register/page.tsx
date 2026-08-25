import { redirect } from "next/navigation";
import { countDosen, getCurrentDosen } from "@/lib/auth";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const hasDosen = countDosen() > 0;
  const dosen = await getCurrentDosen();

  if (hasDosen && !dosen) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-xl font-bold">
          {hasDosen ? "Tambah Akun Dosen" : "Buat Akun Dosen Pertama"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {hasDosen
            ? "Buat akun dosen baru untuk mengelola ujian di aplikasi ini."
            : "Akun ini akan digunakan untuk masuk ke dashboard dan mengelola ujian."}
        </p>
        <RegisterForm redirectAfter={hasDosen ? "/dashboard/akun" : "/dashboard"} />
      </div>
    </div>
  );
}
