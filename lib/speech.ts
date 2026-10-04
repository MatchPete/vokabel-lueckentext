// Aussprache über die eingebaute Sprachausgabe des Browsers (Web Speech API).

/** Macht aus der Buch-Schreibweise einen sprechbaren Text. */
export function speechText(en: string): string {
  return en
    .replace(/\(\s*(AE|BE)\s+[^)]*\)/gi, " ") // "colour (AE color)" -> "colour"
    .replace(/\(\s*=\s*([^)]+)\)/g, ", $1") // "TV (= television)" -> "TV, television"
    .replace(/\bsb\./gi, "somebody")
    .replace(/\bsth\./gi, "something")
    .replace(/\(([^)]*)\)/g, "$1") // "(to) put" -> "to put"
    .replace(/\s*[/;]\s*/g, ", ") // Alternativen nacheinander
    .replace(/(\.\.\.|…)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const by = (test: (v: SpeechSynthesisVoice) => boolean) => voices.find(test) ?? null;
  return (
    by((v) => v.lang.toLowerCase() === "en-gb" && v.localService) ??
    by((v) => v.lang.toLowerCase() === "en-gb") ??
    by((v) => v.lang.toLowerCase().startsWith("en-gb")) ??
    by((v) => v.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

export function speak(en: string) {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speechText(en));
  u.lang = "en-GB";
  u.rate = 0.85; // etwas langsamer für Lernende
  const voice = pickVoice();
  if (voice) u.voice = voice;
  synth.speak(u);
}

/**
 * iPhone/Safari erlauben Sprachausgabe nur nach einer Berührung. Ein stummer Mini-Satz
 * direkt im Tipp-Ereignis "entsperrt" sie für die weitere Runde.
 */
export function unlockSpeech() {
  if (!speechSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignorieren */
  }
}

// Stimmen werden in manchen Browsern erst nachgeladen
if (typeof window !== "undefined" && speechSupported()) {
  window.speechSynthesis.getVoices();
}

// Einstellung "automatisch vorlesen" (pro Gerät, Standard: an)
const AUTO_KEY = "auto-speak";
const listeners = new Set<() => void>();

export function getAutoSpeak(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setAutoSpeak(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "on" : "off");
  } catch {
    /* ignorieren */
  }
  listeners.forEach((l) => l());
}
export function subscribeAutoSpeak(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
