import { requireSuperAdmin } from "@/lib/authz";
import { baseUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

/**
 * A sheet to print and leave on the ring table.
 *
 * Deliberately plain: one code, one address, four lines of instruction, and
 * nothing that costs ink. A judge who has never seen the app should be able to
 * get it installed from this sheet alone, without finding anybody to ask.
 */
export default async function ReleasePosterPage() {
  await requireSuperAdmin();
  const page = `${baseUrl()}/public/app`;
  const plain = page.replace(/^https?:\/\//, "");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Only on screen — the sheet itself starts below. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-gray-500">Print this, or save it as a PDF, and leave it where the judges sit.</p>
        <a href="/app-releases" className="btn-secondary">Back</a>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white p-10 text-center">
        <h1 className="text-4xl font-black tracking-tight text-gray-900">Judge scoreboard app</h1>
        <p className="mt-2 text-lg text-gray-600">Score your ring from your own phone</p>

        <img
          src={`/api/public/qr?url=${encodeURIComponent(page)}&size=460`}
          alt={`QR code for ${page}`}
          width={460}
          height={460}
          className="mx-auto mt-6"
        />

        <p className="mt-4 text-2xl font-bold text-gray-900">{plain}</p>
        <p className="mt-1 text-sm text-gray-500">Scan the code, or type that address into your phone&apos;s browser.</p>

        <ol className="mx-auto mt-8 max-w-md space-y-2 text-left text-base text-gray-800">
          <li><strong>1.</strong> Scan the code above.</li>
          <li><strong>2.</strong> Tap <strong>Download for Android</strong>.</li>
          <li><strong>3.</strong> Open the file. Android warns that it isn&apos;t from the Play Store — that is expected. Allow it, then tap Install.</li>
          <li><strong>4.</strong> Open <strong>TKD Judge</strong> and enter the join code the ring official gives you.</li>
        </ol>

        <p className="mt-8 text-sm text-gray-500">
          On an iPhone, or if you would rather not install anything, open{" "}
          <strong>{plain.replace("/app", "/judge")}</strong> in your browser instead.
        </p>
      </div>
    </div>
  );
}
