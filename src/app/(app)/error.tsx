"use client";

import { useRouter } from "next/navigation";

// Next.js redacts thrown error messages from Server Actions/Server
// Components in production and replaces them with a generic message plus a
// `digest`. We show a neutral title (not "Access denied", which was
// misleading for non-permission errors) and give the user a way back.
export default function AppError({ error }: { error: Error & { digest?: string } }) {
  const router = useRouter();
  const isPermissionError = /permission|access|super admin|own club|own account/i.test(error.message);

  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="text-lg font-semibold text-red-700">
        {isPermissionError ? "Access denied" : "Something went wrong"}
      </h2>
      <p className="mt-2 text-sm text-gray-600">{error.message}</p>
      {error.digest && <p className="mt-1 text-xs text-gray-400">Reference: {error.digest}</p>}
      <button onClick={() => router.back()} className="btn-secondary mt-4">
        Go back
      </button>
    </div>
  );
}
