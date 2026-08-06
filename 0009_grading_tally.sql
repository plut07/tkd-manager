import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <header className="hero-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/public/events" className="text-lg font-bold text-white drop-shadow">
            TKD Manager — Public Events
          </Link>
          <Link href="/login" className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-white">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
