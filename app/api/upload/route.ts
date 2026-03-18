import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { uploadAndIndexPdf } from "@/app/services/pdf-upload-service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Geen PDF-bestand ontvangen." },
        { status: 400 },
      );
    }

    const result = await uploadAndIndexPdf(file);

    if (result.ok) {
      revalidatePath("/search");
      revalidatePath("/upload");
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    console.error("API upload fout:", error);
    return NextResponse.json(
      { ok: false, message: "Upload mislukt. Probeer opnieuw." },
      { status: 500 },
    );
  }
}
