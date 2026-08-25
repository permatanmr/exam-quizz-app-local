import { redirect } from "next/navigation";
import { getCurrentDosen } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const dosen = await getCurrentDosen();
  if (dosen) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-xl font-bold">Masuk Dosen</h1>
        <p className="mt-1 text-sm text-muted">Masuk ke dashboard untuk mengelola ujian.</p>
        <LoginForm />
      </div>
    </div>
  );
}
