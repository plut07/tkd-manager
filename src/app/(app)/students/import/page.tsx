import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import ImportWizard from "@/components/ImportWizard";
import { previewStudentImport, commitStudentImport } from "../../importActions";

export default async function ImportStudentsPage() {
  const session = await requirePermission(PERMISSIONS.STUDENT_CREATE);
  if (session.role === "club_admin") {
    throw new Error("Bulk import is available to Super Admins and Event Managers. Add students individually from the Students page.");
  }
  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900">Import students</h1>
      <p className="mt-1 text-sm text-gray-500">Add many students at once from a spreadsheet.</p>
      <div className="mt-6">
        <ImportWizard kind="students" preview={previewStudentImport} commit={commitStudentImport} backHref="/students" backLabel="Back to students" />
      </div>
    </div>
  );
}
