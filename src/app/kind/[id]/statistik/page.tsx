import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatsView from "@/components/StatsView";
import type { ChildStats } from "@/lib/stats";

export default async function StatsPage(props: PageProps<"/kind/[id]/statistik">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const [{ data: child }, { data: raw }] = await Promise.all([
    supabase.from("children").select("id, nickname").eq("id", id).maybeSingle(),
    supabase.rpc("child_stats", { p_child_id: id }),
  ]);
  if (!child || !raw) notFound();

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {child.nickname}</Link>
      <h1 className="title">Statistik</h1>
      <StatsView stats={raw as ChildStats} />
    </main>
  );
}
