import type { Metadata } from "next";
import "../styles/globals.css";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AI Arcade",
  description: "AI Native interactive game platform MVP"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <Header user={user} />
        <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
