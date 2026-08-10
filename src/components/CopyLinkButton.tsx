"use client";
import { useState } from "react";

/** Copies a link to the clipboard, with a brief confirmation in place. */
export default function CopyLinkButton({ url, label = "Copy sign link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-sm font-medium text-brand-700 hover:underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Copy this link:", url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
