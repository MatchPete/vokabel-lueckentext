import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateGrammarExercise, GrammarError } from "@/lib/grammar/generate";

export const maxDuration = 120;
const DAILY_LIMIT = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { childId?: string; chapter?: string } | null;
  if (!body?.childId || !body.chapter) return NextResponse.json({ error: "Angaben fehlen." }, { status: 400 });

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_quota", { p_kind: "grammar", p_limit: DAILY_LIMIT });
  if (quotaError) return NextResponse.json({ error: "Interner Fehler (Limit)." }, { status: 500 });
  if (!allowed) return NextResponse.json({ error: `Für heute sind ${DAILY_LIMIT} Grammatikübungen erreicht. Morgen geht es weiter.` }, { status: 429 });

  try {
    const id = await generateGrammarExercise(supabase, body.childId, body.chapter);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof GrammarError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("grammar", e);
    return NextResponse.json({ error: "Die Übung konnte nicht erstellt werden." }, { status: 500 });
  }
}
