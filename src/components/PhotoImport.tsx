"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVocabBatch, type ImportRow } from "@/app/actions";
import { normalize } from "@/lib/exercise";
import { SECTION_LABELS, type Section } from "@/lib/types";

type Shot = { id: number; blob: Blob; url: string };
type Row = ImportRow & { key: number; include: boolean; duplicate: "saved" | "batch" | null; uncertain: boolean };
type Props = { childId: string; unitId: string; sections: Section[]; existingKeys: string[] };

const MAX_EDGE = 1600;

/** Verkleinert ein Bild auf höchstens MAX_EDGE Pixel Kantenlänge und liefert ein JPEG. */
async function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht erzeugt werden"))), "image/jpeg", 0.85),
  );
}

export default function PhotoImport({ childId, unitId, sections, existingKeys }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextId = useRef(1);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [step, setStep] = useState<"capture" | "processing" | "review">("capture");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pageErrors, setPageErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Die Kamera ist in diesem Browser nicht verfügbar. Nutze „Kamera-App“ darunter.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
      } catch {
        setCameraError("Kein Zugriff auf die Kamera. Erlaube ihn in den Browser-Einstellungen oder nutze „Kamera-App“ darunter.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Vorschaubilder erst beim Verlassen der Seite freigeben (nicht bei jeder Änderung der Liste)
  const shotsRef = useRef<Shot[]>([]);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  function removeShot(id: number) {
    setShots((all) => {
      const hit = all.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return all.filter((x) => x.id !== id);
    });
  }

  function addShot(blob: Blob) {
    setShots((s) => [...s, { id: nextId.current++, blob, url: URL.createObjectURL(blob) }]);
  }

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    addShot(await toJpeg(v, v.videoWidth, v.videoHeight));
  }

  async function addFiles(files: File[] | FileList | null) {
    for (const f of Array.from(files ?? [])) {
      try {
        const bmp = await createImageBitmap(f);
        addShot(await toJpeg(bmp, bmp.width, bmp.height));
        bmp.close();
      } catch {
        setCameraError("Ein Bild konnte nicht gelesen werden.");
      }
    }
  }

  async function analyze() {
    stopCamera();
    setStep("processing");
    setProgress({ done: 0, total: shots.length });
    const errors: string[] = [];
    const found: Row[] = [];
    let lastSection: Section | null = null;
    let key = 0;

    for (let i = 0; i < shots.length; i++) {
      try {
        const fd = new FormData();
        fd.append("image", shots[i].blob, `seite-${i + 1}.jpg`);
        const res = await fetch("/api/vocab/import", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.status === 504 || res.status === 408) {
          throw new Error("Zeitüberschreitung. Bei sehr vollen Seiten hilft es, je eine halbe Seite zu fotografieren.");
        }
        if (!res.ok) throw new Error(data.error || "Auswertung fehlgeschlagen.");
        for (const e of data.entries as Array<{ en: string; de: string; section: Section | null; word_type: string | null; example_en: string | null; uncertain: boolean }>) {
          // Ohne erkennbare Überschrift gilt der zuletzt gesehene Abschnitt (auch über Seitengrenzen)
          const section: Section = e.section && sections.includes(e.section) ? e.section : (lastSection ?? sections[0]);
          lastSection = section;
          found.push({ ...e, section, key: key++, include: true, duplicate: null });
        }
        if (data.truncated) errors.push(`Seite ${i + 1}: Sehr viele Einträge, eventuell fehlen die letzten. Bitte prüfen.`);
      } catch (err) {
        const msg = err instanceof TypeError ? "Keine Verbindung. Bitte Internet prüfen." : err instanceof Error ? err.message : "Fehler";
        errors.push(`Seite ${i + 1}: ${msg}`);
      }
      setProgress({ done: i + 1, total: shots.length });
    }

    // Duplikate markieren: schon gespeichert oder doppelt in diesem Durchgang
    const saved = new Set(existingKeys);
    const inBatch = new Set<string>();
    for (const r of found) {
      const k = `${normalize(r.en)}|${normalize(r.de)}`;
      if (saved.has(k)) r.duplicate = "saved";
      else if (inBatch.has(k)) r.duplicate = "batch";
      if (r.duplicate) r.include = false;
      inBatch.add(k);
    }

    setPageErrors(errors);
    setRows(found);
    setStep("review");
  }

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function save() {
    setSaveError(null);
    const selected = rows
      .filter((r) => r.include)
      .map(({ en, de, section, word_type, example_en }) => ({ en, de, section, word_type, example_en }));
    startSaving(async () => {
      const res = await saveVocabBatch({ childId, unitId, rows: selected });
      if (res.ok) router.push(`/kind/${childId}/unit/${unitId}?importiert=${res.inserted}`);
      else setSaveError(res.error);
    });
  }

  // ---------------------------------------------------------------- Ansicht
  if (step === "processing") {
    return (
      <section className="card stack" aria-live="polite">
        <p className="subtitle">Seiten werden gelesen …</p>
        <p className="lead">
          Seite {Math.min(progress.done + 1, progress.total)} von {progress.total}. Pro Seite dauert es etwa 10 bis 30 Sekunden.
        </p>
        <progress value={progress.done} max={progress.total} className="progress" />
      </section>
    );
  }

  if (step === "review") {
    const selectedCount = rows.filter((r) => r.include).length;
    const dupCount = rows.filter((r) => r.duplicate === "saved").length;
    const batchCount = rows.filter((r) => r.duplicate === "batch").length;
    const uncertainCount = rows.filter((r) => r.uncertain).length;
    return (
      <>
        <section className="stack">
          <p className="lead">
            {rows.length} Vokabeln gefunden
            {dupCount > 0 && `, davon ${dupCount} schon gespeichert`}
            {batchCount > 0 && `${dupCount > 0 ? " und" : ", davon"} ${batchCount} doppelt fotografiert`}
            {uncertainCount > 0 && `. ${uncertainCount} schwer lesbar – bitte besonders prüfen`}.
          </p>
          {pageErrors.map((e) => (
            <p key={e} className="error">{e}</p>
          ))}
        </section>

        <ul className="review">
          {rows.map((r) => (
            <li key={r.key} className={`review-row${r.include ? "" : " is-off"}${r.uncertain ? " is-uncertain" : ""}`}>
              <label className="review-check">
                <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                <span className="sr-only">übernehmen</span>
              </label>
              <div className="review-fields">
                <input
                  value={r.en}
                  lang="en"
                  aria-label="Englisch"
                  onChange={(e) => update(r.key, { en: e.target.value })}
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                />
                <input
                  value={r.de}
                  lang="de"
                  aria-label="Deutsch"
                  onChange={(e) => update(r.key, { de: e.target.value })}
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                />
                <div className="review-meta">
                  {sections.length > 1 && (
                    <select value={r.section} aria-label="Abschnitt" onChange={(e) => update(r.key, { section: e.target.value as Section })}>
                      {sections.map((s) => (
                        <option key={s} value={s}>{SECTION_LABELS[s]}</option>
                      ))}
                    </select>
                  )}
                  {r.duplicate === "saved" && <span className="badge">schon gespeichert</span>}
                  {r.duplicate === "batch" && <span className="badge">doppelt</span>}
                  {r.uncertain && <span className="badge badge-warn">prüfen</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="check-bar">
          {saveError && <p className="error">{saveError}</p>}
          <button type="button" className="btn" onClick={save} disabled={saving || selectedCount === 0}>
            {saving ? "Wird gespeichert …" : `${selectedCount} Vokabeln speichern`}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="capture">
      <section className="camera">
        <video ref={videoRef} playsInline muted className={cameraOn ? "" : "is-hidden"} />
        {cameraOn && <div className="camera-frame" aria-hidden />}
        {!cameraOn && !cameraError && <p className="camera-placeholder">Kamera wird gestartet …</p>}
        {cameraError && <p className="camera-placeholder">{cameraError}</p>}
      </section>

      <div className="camera-actions">
        {cameraOn && (
          <button type="button" className="shutter" onClick={capture} aria-label="Foto aufnehmen">
            <span />
          </button>
        )}
        <div className="file-btns">
          {/* capture öffnet auf Android direkt die Kamera-App (ein Foto pro Antippen) */}
          <label className="btn-quiet file-btn">
            Kamera-App
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []); // erst kopieren, dann Feld leeren
                e.target.value = "";
                addFiles(files);
              }}
            />
          </label>
          <label className="btn-quiet file-btn">
            Aus Galerie
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []); // erst kopieren, dann Feld leeren
                e.target.value = "";
                addFiles(files);
              }}
            />
          </label>
        </div>
      </div>

      <p className="hint">
        Tipp: Eine Seite pro Foto, möglichst gerade von oben, gut ausgeleuchtet und ohne Schatten. Die Seite sollte das Bild ausfüllen.
      </p>

      {shots.length > 0 && (
        <section className="stack">
          <ul className="thumbs">
            {shots.map((s, i) => (
              <li key={s.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={`Seite ${i + 1}`} />
                <button type="button" className="thumb-del" aria-label={`Seite ${i + 1} entfernen`} onClick={() => removeShot(s.id)}>×</button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={analyze}>
            {shots.length === 1 ? "1 Seite auswerten" : `${shots.length} Seiten auswerten`}
          </button>
        </section>
      )}
    </div>
  );
}
