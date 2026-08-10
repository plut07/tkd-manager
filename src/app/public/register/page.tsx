import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import AccessRequestForm from "@/components/AccessRequestForm";
import { submitAccessRequest } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RequestAccessPage() {
  const { data: clubs } = await supabaseAdmin().from("clubs").select("id, name").eq("active", true).order("name");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Request access</h1>
      <p className="mt-1 text-sm text-gray-600">
        Fill in your details and choose a password. A Super Admin reviews every request — you&apos;ll be able to sign in
        once yours is approved.
      </p>
      <div className="mt-6">
        <AccessRequestForm action={submitAccessRequest} clubs={clubs ?? []} />
      </div>
      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
