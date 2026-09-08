import Link from "next/link";

/**
 * "You can't open this page", said properly.
 *
 * Three pages guarded themselves by throwing during render — the right check,
 * the wrong way to report it. A throw from a Server Component in production is
 * replaced with the generic "Something went wrong" page, so a Club User who
 * clicked Import got a red crash and a reference number instead of the sentence
 * that had been written for them, and no way back except the browser's Back
 * button.
 *
 * The check stays; the page just renders this instead of exploding. It is not
 * an error — the app is working exactly as designed, and it should look like it.
 */
export default function NotAllowed({
  title = "You don't have access to this page",
  message,
  backHref,
  backLabel = "Go back",
}: {
  title?: string;
  message: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
      <h1 className="text-lg font-semibold text-amber-900">{title}</h1>
      <p className="mt-2 text-sm text-amber-800">{message}</p>
      <Link href={backHref} className="btn-secondary mt-5 inline-block">
        {backLabel}
      </Link>
    </div>
  );
}
