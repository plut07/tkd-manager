"use client";

import { useRef, useTransition } from "react";

export default function PermissionToggle({
  action,
  roleId,
  permissionId,
  enabled,
  disabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  roleId: string;
  permissionId: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(() => {
          void action(formData);
        })
      }
    >
      <input type="hidden" name="roleId" value={roleId} />
      <input type="hidden" name="permissionId" value={permissionId} />
      <input type="hidden" name="enabled" value={String(enabled)} />
      <input
        type="checkbox"
        defaultChecked={enabled}
        disabled={disabled || isPending}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
      />
    </form>
  );
}
