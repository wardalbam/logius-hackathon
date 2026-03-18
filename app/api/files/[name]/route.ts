import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deletePdfBySource } from "@/app/services/pdf-upload-service";

const DATA_DIR = path.join(process.cwd(), "data");

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await context.params;
    const decodedName = decodeURIComponent(name);
    const safeName = path.basename(decodedName);

    if (safeName !== decodedName || !safeName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ message: "Ongeldige bestandsnaam." }, { status: 400 });
    }

    const filePath = path.join(DATA_DIR, safeName);
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ message: "Bestand niet gevonden." }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await context.params;
    const decodedName = decodeURIComponent(name);
    const safeName = path.basename(decodedName);

    if (safeName !== decodedName || !safeName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ ok: false, message: "Ongeldige bestandsnaam." }, { status: 400 });
    }

    const result = await deletePdfBySource(safeName);

    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    revalidatePath("/search");
    revalidatePath("/upload");

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("API delete fout:", error);
    return NextResponse.json(
      { ok: false, message: "Verwijderen mislukt. Probeer opnieuw." },
      { status: 500 },
    );
  }
}
