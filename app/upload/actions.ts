"use server";

import { revalidatePath } from "next/cache";
import { type UploadResult, uploadAndIndexPdf } from "@/app/services/pdf-upload-service";

export const initialUploadState: UploadResult = {
  ok: false,
  message: "",
};

export async function uploadPdfAction(
  _prevState: UploadResult,
  formData: FormData,
): Promise<UploadResult> {
  try {
    const file = formData.get("pdf");

    if (!(file instanceof File)) {
      return { ok: false, message: "Geen PDF-bestand ontvangen." };
    }
    const result = await uploadAndIndexPdf(file);
    revalidatePath("/search");
    revalidatePath("/upload");

    return result;
  } catch (error) {
    console.error("Upload en indexering mislukt:", error);
    return {
      ok: false,
      message: "Upload mislukt. Probeer opnieuw.",
    };
  }
}
