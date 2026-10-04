"use client";

import { useSyncExternalStore } from "react";
import { speak, speechSupported, getAutoSpeak, setAutoSpeak, subscribeAutoSpeak } from "@/lib/speech";

const noop = () => () => {};

export function useSpeechSupported() {
  return useSyncExternalStore(noop, speechSupported, () => false);
}

export function useAutoSpeak() {
  return useSyncExternalStore(subscribeAutoSpeak, getAutoSpeak, () => true);
}

/** Lautsprecher-Knopf: spricht das englische Wort aus. Ohne Sprachausgabe im Browser unsichtbar. */
export default function SpeakButton({ text, label = "Aussprache anhören" }: { text: string; label?: string }) {
  const supported = useSpeechSupported();
  if (!supported) return null;
  return (
    <button type="button" className="speak-btn" onClick={() => speak(text)} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function AutoSpeakToggle() {
  const supported = useSpeechSupported();
  const on = useAutoSpeak();
  if (!supported) return null;
  return (
    <label className="auto-speak">
      <input type="checkbox" checked={on} onChange={(e) => setAutoSpeak(e.target.checked)} />
      Wörter automatisch vorlesen
    </label>
  );
}
