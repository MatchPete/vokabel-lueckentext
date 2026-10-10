import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractVocabulary, ExtractError } from "@/lib/extract";
import { sectionsFor } from "@/lib/types";

export const maxDuration = 60;

const DAILY_LIMIT = 40;
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Kein Foto erhalten." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Das Foto ist zu groß." }, { status: 413 });
  }
  const type = TYPES.find((t) => t === file.type);
  if (!type) return NextResponse.json({ error: "Dieses Bildformat wird nicht unterstützt." }, { status: 415 });

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_quota", {
    p_kind: "photo",
    p_limit: DAILY_LIMIT,
  });
  if (quotaError) return NextResponse.json({ error: "Interner Fehler (Limit)." }, { status: 500 });
  if (!allowed) {
    return NextResponse.json({ error: `Für heute sind ${DAILY_LIMIT} Fotos erreicht. Morgen geht es weiter.` }, { status: 429 });
  }

  try {
    // Das Foto wird nur an Claude weitergereicht und nirgends gespeichert.
    // Buch des Kindes und Abschnitte der Unit für die Anweisung an Claude
    const childId = String(form?.get("child_id") ?? "");
    const unitId = String(form?.get("unit_id") ?? "");
    const [{ data: child }, { data: unit }] = await Promise.all([
      childId
        ? supabase.from("children").select("textbooks(name, sections)").eq("id", childId).maybeSingle()
        : Promise.resolve({ data: null }),
      unitId
        ? supabase.from("units").select("textbook_units(kind, sections)").eq("id", unitId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const tb = (child as unknown as { textbooks: { name: string; sections: string[] } | null } | null)?.textbooks;
    const tu = (unit as unknown as { textbook_units: { kind: string; sections: string[] | null } | null } | null)?.textbook_units;
    const result = await extractVocabulary(new Uint8Array(await file.arrayBuffer()), type, {
      name: tb?.name ?? "",
      sections: sectionsFor(tb?.sections, tu ? tu.kind === "unit" : true, tu?.sections),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ExtractError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("extractVocabulary failed", e);
    return NextResponse.json({ error: "Die Seite konnte nicht ausgewertet werden. Bitte noch einmal versuchen." }, { status: 500 });
  }
}
