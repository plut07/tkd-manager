import Link from "next/link";
import FlashBanner from "@/components/FlashBanner";

/**
 * The public shell.
 *
 * A dark bar across the top with the things a visitor actually came for, in the
 * order the ITF's own portal puts them — events first, then the live screen,
 * then sign-in on the right. Every link goes somewhere real; a nav full of
 * headings that do nothing is worse than a short one.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/public/events" className="text-base font-extrabold uppercase tracking-wide text-white">
            TKD<span className="text-brand-400">Manager</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
            <Link href="/public/events" className="hover:text-white">Events</Link>
            <Link href="/public/judge" className="hover:text-white">Judge sign-in</Link>
            <Link href="/public/app" className="hover:text-white">Judge app</Link>
            <Link href="/public/register" className="hover:text-white">Request access</Link>
          </nav>

          <Link
            href="/login"
            className="ml-auto rounded-md bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <FlashBanner />
        {children}
      </main>

      <footer className="mt-12 border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p>TKD Manager — event &amp; student management for ITF Taekwon-Do.</p>
      </footer>
    </div>
  );
}
