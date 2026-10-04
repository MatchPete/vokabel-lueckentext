import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flagExercise } from "@/app/actions";
import ExercisePlayer from "@/components/ExercisePlayer";
import { TEXT_TYPE_LABELS, type Segment, type TextType } from "@/lib/exercise";

export default async function ExercisePage(props: PageProps<"/kind/[id]/ueben/[exerciseId]">) {
  const { id, exerciseId } = await props.params;
  const supabase = await createClient();

  const [{ data: child }, { data: ex }] = await Promise.all([
    supabase.from("children").select("id, nickname").eq("id", id).maybeSingle(),
    supabase
      .from("exercises")
      .select("id, child_id, unit_id, title, text_type, theme, segments, flagged")
      .eq("id", exerciseId)
      .eq("child_id", id)
      .maybeSingle(),
  ]);
  if (!child || !ex) notFound();

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {child.nickname}</Link>
      <div>
        <p className="eyebrow">{TEXT_TYPE_LABELS[ex.text_type as TextType]}{ex.theme ? ` · ${ex.theme}` : ""}</p>
        <h1 className="title" lang="en">{ex.title}</h1>
      </div>
      <p className="lead">Schreib die englischen Wörter in die Lücken. Das deutsche Wort steht darunter.</p>

      <ExercisePlayer
        key={exerciseId}
        exerciseId={ex.id}
        childId={id}
        childName={child.nickname}
        unitId={ex.unit_id}
        segments={ex.segments as Segment[]}
      />

      <form action={flagExercise} className="footer">
        <input type="hidden" name="exercise_id" value={ex.id} />
        {ex.flagged ? (
          <p className="hint">Als komisch gemeldet. Danke!</p>
        ) : (
          <button className="link">Text ist komisch? Melden</button>
        )}
      </form>
    </main>
  );
}
