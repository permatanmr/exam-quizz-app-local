import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDosen } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dosen = await getCurrentDosen();
  if (!dosen) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            SIUJIAN
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="font-semibold">{dosen.name}</div>
              <div className="text-muted">{dosen.email}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
