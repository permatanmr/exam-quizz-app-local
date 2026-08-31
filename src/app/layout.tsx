import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIUJIAN — Aplikasi Ujian Online",
  description: "Aplikasi ujian pilihan ganda untuk dosen dan mahasiswa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='id' className='h-full antialiased' suppressHydrationWarning>
      <body
        className='min-h-full flex flex-col bg-background text-foreground'
        suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
