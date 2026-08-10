import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white drop-shadow">
          <h1 className="text-3xl font-extrabold tracking-tight">TKD Manager</h1>
          <p className="mt-1 text-sm text-white/80">Event & student management</p>
        </div>
        <div className="card p-6">
          <LoginForm next={searchParams?.next} />
        </div>
        <p className="mt-3 text-center text-sm text-white/80">
          Need an account?{" "}
          <Link href="/public/register" className="font-medium text-white hover:underline">Request access</Link>
        </p>
        <p className="mt-2 text-center text-sm text-white/80">
          <Link href="/public/events" className="font-medium text-white hover:underline">
            View upcoming events
          </Link>{" "}
          without signing in
        </p>
      </div>
    </div>
  );
}
