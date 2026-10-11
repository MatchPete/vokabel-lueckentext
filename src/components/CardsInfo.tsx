"use client";

import { useId, useState } from "react";
import type { CardsBreakdown } from "@/lib/progress";

/** ⓘ-Knopf mit Erklärung, wann eine Vokabel auf einer Karteikarte landet – mit den Zahlen dieser Lektion. */
export default function CardsInfo({ b, excluded = 0, scope = "dieser Lektion" }: { b: CardsBreakdown; excluded?: number; scope?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;

  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Wie kommen Wörter auf die Karteikarten?"
        title="Wie kommen Wörter auf die Karteikarten?"
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <div id={id} className="info-panel card stack" role="region" aria-label="Erklärung Karteikarten">
          <p className="info-sum">
            In {scope} {b.total === 1 ? "ist" : "sind"} <strong>{n(b.total, "Wort", "Wörter")}</strong>
            {excluded > 0 && <> (plus {excluded} gesperrte)</>}. Heute kommen <strong>{n(b.inRound, "Karte", "Karten")}</strong> dran:
          </p>
          <ul className="info-list">
            <li>
              <strong>{b.dueToday}</strong> zum Wiederholen – Wörter, die schon geübt wurden und heute wieder fällig sind
              {b.dueNow > b.dueToday && <> (insgesamt {b.dueNow} fällig, höchstens {b.roundSize} pro Runde)</>}
            </li>
            <li>
              <strong>{b.newToday}</strong> neue – noch nie geübte Wörter, höchstens {b.newPerRound} pro Runde
              {b.fresh > b.newToday && <> ({b.fresh - b.newToday} weitere neue warten)</>}
            </li>
            <li>
              <strong>{b.later}</strong> ruhen gerade – sie wurden richtig gewusst und kommen erst an einem späteren Tag wieder
            </li>
          </ul>
          <p className="info-head">Wann kommt ein Wort auf eine Karte?</p>
          <ul className="info-list">
            <li><strong>Neu eingetragen:</strong> Es wartet, bis in einer Runde Platz für neue Wörter ist – in der Reihenfolge, in der es eingetragen wurde.</li>
            <li><strong>Richtig:</strong> Es kommt nach 1 Tag wieder, dann nach 3 Tagen, danach in immer größeren Abständen (etwa das Zweieinhalbfache, bis höchstens 4 Monate).</li>
            <li><strong>Fast richtig</strong> (kleiner Fehler): Es kommt etwas früher wieder als bei einer richtigen Antwort.</li>
            <li><strong>Falsch:</strong> Es kommt in derselben Runde noch einmal und bleibt heute fällig; danach beginnen die Abstände von vorn.</li>
            <li><strong>Gesperrt:</strong> Es kommt nie dran, bis es wieder freigegeben wird.</li>
          </ul>
          <p className="hint">
            Mehr neue Wörter: nach einer Runde „Weiter üben“ tippen. Alles auf einmal vor einer Abfrage: in der Lektion
            „Alle Wörter üben“. Wie viele Karten pro Runde, lässt sich in den Einstellungen ändern.
          </p>
        </div>
      )}
    </>
  );
}
