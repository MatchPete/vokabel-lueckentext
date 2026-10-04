"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { childId: string; unitId: string; label?: string; quiet?: boolean };

export default function StartExercise({ childId, unitId, label = "Üben", quiet = false }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, unitId }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.status === 504 || res.status === 408) throw new Error("Das hat zu lange gedauert. Bitte noch einmal versuchen.");
      if (!res.ok || !data.id) throw new Error(data.error || "Das hat nicht geklappt.");
      router.push(`/kind/${childId}/ueben/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setPending(false);
    }
  }

  return (
    <div className="start">
      <button type="button" className={quiet ? "btn-quiet" : "btn"} onClick={start} disabled={pending}>
        {pending ? "Geschichte wird geschrieben …" : label}
      </button>
      <p className="form-status" role="status" aria-live="polite">
        {pending && <span>Das dauert meist 10 bis 30 Sekunden.</span>}
        {error && <span className="error">{error}</span>}
      </p>
    </div>
  );
}
