"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartGrammar({ childId, chapter, label = "Übung starten" }: { childId: string; chapter: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, chapter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      router.push(`/kind/${childId}/grammatik/${chapter}/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <button type="button" className="btn" onClick={start} disabled={busy}>
        {busy ? "Übung wird erstellt … (ca. 15 Sekunden)" : label}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
