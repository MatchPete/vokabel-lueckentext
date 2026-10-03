import { ImageResponse } from "next/og";

// App-Icons werden zur Laufzeit erzeugt: liniertes Heftblatt mit einer Lücke in Tinte.
const VARIANTS: Record<string, { size: number; inset: number }> = {
  "192": { size: 192, inset: 0 },
  "512": { size: 512, inset: 0 },
  maskable: { size: 512, inset: 0.12 },
};

export async function GET(_req: Request, ctx: RouteContext<"/app-icon/[variant]">) {
  const { variant } = await ctx.params;
  const v = VARIANTS[variant];
  if (!v) return new Response("Not found", { status: 404 });

  const s = v.size;
  const step = s / 8;
  const lines = Array.from({ length: 7 }, (_, i) => (i + 1) * step);
  const x0 = s * (0.3 + v.inset);
  const x1 = s * (0.82 - v.inset);

  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", position: "relative", background: "#F7F9FC" }}>
        {lines.map((y) => (
          <div key={y} style={{ position: "absolute", left: 0, top: y, width: s, height: Math.max(1, s / 128), background: "#CAD7EA" }} />
        ))}
        <div style={{ position: "absolute", left: s * 0.18, top: 0, width: Math.max(1, s / 96), height: s, background: "#E6A3AB" }} />
        <div
          style={{
            position: "absolute",
            left: x0,
            top: s * 0.24,
            width: x1 - x0,
            display: "flex",
            justifyContent: "center",
            fontSize: s * 0.36,
            fontWeight: 700,
            color: "#1D3C8F",
          }}
        >
          a
        </div>
        <div style={{ position: "absolute", left: x0, top: s * 0.62, width: x1 - x0, height: Math.max(6, s / 22), borderRadius: s / 60, background: "#1D3C8F" }} />
      </div>
    ),
    { width: s, height: s },
  );
}
