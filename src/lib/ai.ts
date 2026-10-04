// Zentrale Anbindung an Claude.
// Bevorzugt: Vercel AI Gateway (wie bei Küchentafel) über AI_GATEWAY_API_KEY.
// Alternativ: direkt bei Anthropic über ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";

const GATEWAY_URL = "https://ai-gateway.vercel.sh";

export class AiConfigError extends Error {}

export function aiClient(): { client: Anthropic; model: string } {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  // Schutz vor einem Fehler, der bei Küchentafel passiert ist: Schlüssel versehentlich im Modell-Feld.
  const configured = process.env.AI_MODEL?.trim();
  const modelOverride = configured && !/^(vck_|sk-)/.test(configured) ? configured : undefined;

  if (gatewayKey) {
    return {
      client: new Anthropic({ apiKey: null, authToken: gatewayKey, baseURL: GATEWAY_URL }),
      model: modelOverride ?? "anthropic/claude-sonnet-5",
    };
  }
  if (anthropicKey) {
    return {
      client: new Anthropic({ apiKey: anthropicKey }),
      model: modelOverride ?? "claude-sonnet-5-5",
    };
  }
  throw new AiConfigError("In Vercel fehlt der KI-Schlüssel (AI_GATEWAY_API_KEY).");
}
