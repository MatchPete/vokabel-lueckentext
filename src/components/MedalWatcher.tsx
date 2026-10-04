"use client";

import { useEffect, useState } from "react";
import Confetti from "./Confetti";
import { medalInfo } from "@/lib/stats";

/**
 * Zeigt einmalig "Neue Medaille!", wenn seit dem letzten Besuch eine dazugekommen ist.
 * Merkt sich das nur auf diesem Gerät (localStorage). Beim allerersten Besuch wird nicht gefeiert.
 */
export default function MedalWatcher({ childId, learned }: { childId: string; learned: number }) {
  const [newMedal, setNewMedal] = useState<number | null>(null);

  useEffect(() => {
    const key = `medals-seen:${childId}`;
    const count = medalInfo(learned).earned.length;
    let seen: number | null = null;
    try {
      const raw = localStorage.getItem(key);
      seen = raw === null ? null : Number(raw);
      localStorage.setItem(key, String(count));
    } catch {
      return;
    }
    if (seen !== null && count > seen) {
      const latest = medalInfo(learned).earned[count - 1];
      // Nach dem Rendern anzeigen (nicht synchron im Effekt)
      const t = setTimeout(() => setNewMedal(latest.at), 0);
      return () => clearTimeout(t);
    }
  }, [childId, learned]);

  if (newMedal === null) return null;
  return (
    <>
      <Confetti fire />
      <div className="card medal-toast" role="status">
        <span className="medal medal-lg medal-new">{newMedal}</span>
        <div>
          <p className="current-title">Neue Medaille!</p>
          <p className="lead">{newMedal} Wörter gelernt. Super!</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Schließen" onClick={() => setNewMedal(null)}>×</button>
      </div>
    </>
  );
}
