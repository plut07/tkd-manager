import { requireSuperAdmin } from "@/lib/authz";
import ImportWizard from "@/components/ImportWizard";
import { previewClubImport, commitClubImport } from "../../importActions";

export default async function ImportClubsPage() {
  await requireSuperAdmin();
  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900">Import clubs</h1>
      <p className="mt-1 text-sm text-gray-500">Add many clubs at once from a spreadsheet.</p>
      <div className="mt-6">
        <ImportWizard kind="clubs" preview={previewClubImport} commit={commitClubImport} backHref="/clubs" backLabel="Back to clubs" />
      </div>
    </div>
  );
}
