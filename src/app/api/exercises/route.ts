import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { generateExercise, GenerateError } from "@/lib/generate";

export const maxDuration = 60;

const DAILY_LIMIT = 25;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { childId?: string; unitId?: string } | null;
  if (!body?.childId || !body?.unitId) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_quota", {
    p_kind: "exercise",
    p_limit: DAILY_LIMIT,
  });
  if (quotaError) return NextResponse.json({ error: "Interner Fehler (Limit)." }, { status: 500 });
  if (!allowed) {
    return NextResponse.json({ error: `Für heute sind ${DAILY_LIMIT} neue Geschichten erreicht. Morgen geht es weiter.` }, { status: 429 });
  }

  try {
    const id = await generateExercise(supabase, body.childId, body.unitId);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof GenerateError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("generateExercise failed", e);
    return NextResponse.json({ error: "Die Geschichte konnte nicht erstellt werden. Bitte später noch einmal versuchen." }, { status: 500 });
  }
}
