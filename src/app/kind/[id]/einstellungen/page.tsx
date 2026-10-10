import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import { parseSettings } from "@/lib/settings";

export default async function SettingsPage(props: PageProps<"/kind/[id]/einstellungen">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: child } = await supabase.from("children").select("id, nickname, settings").eq("id", id).maybeSingle();
  if (!child) notFound();

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {child.nickname}</Link>
      <h1 className="title">Einstellungen</h1>
      <p className="lead">Gilt für {child.nickname} auf allen Geräten. Änderungen werden sofort gespeichert.</p>
      <SettingsForm childId={child.id} nickname={child.nickname} initial={parseSettings(child.settings)} />
    </main>
  );
}
