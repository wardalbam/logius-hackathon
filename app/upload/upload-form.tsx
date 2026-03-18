"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { initialUploadState, uploadPdfAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Bezig met uploaden..." : "Uploaden en indexeren"}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useActionState(uploadPdfAction, initialUploadState);

  return (
    <form action={formAction} className="w-full max-w-xl border rounded-lg p-6 flex flex-col gap-4">
      <label htmlFor="pdf" className="text-sm font-medium text-gray-700">
        Kies een PDF-bestand
      </label>
      <input
        id="pdf"
        name="pdf"
        type="file"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700"
      />

      <SubmitButton />

      {state.message && (
        <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
          {state.message}
          {state.ok && state.source ? ` (${state.source})` : ""}
        </p>
      )}
    </form>
  );
}
