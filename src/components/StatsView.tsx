import { fillCurve, MEDALS, medalInfo, type ChildStats } from "@/lib/stats";

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(d + "T12:00:00").toLocaleDateString("de-DE", opts);

export default function StatsView({ stats: raw }: { stats: ChildStats }) {
  const s = raw as ChildStats;
  const { earned, next, toNext } = medalInfo(s.learned);
  const curve = fillCurve(s.curve, s.today);

  // Lernkurve als SVG
  const W = 320, H = 150, P = 28;
  const maxY = Math.max(10, ...curve.map((c) => c.total));
  const x = (i: number) => P + (curve.length <= 1 ? (W - 2 * P) / 2 : (i / (curve.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - (v / maxY) * (H - 2 * P);
  const line = curve.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.total).toFixed(1)}`).join(" ");
  const area = curve.length ? `${line} L${x(curve.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z` : "";

  const maxA = Math.max(5, ...s.activity.map((a) => a.answers));

  return (
    <>
      <section className="stat-grid">
        <div className="card stat">
          <span className="stat-num">{s.learned}</span>
          <span className="stat-label">Wörter gelernt</span>
        </div>
        <div className="card stat">
          <span className="stat-num">{s.streak}</span>
          <span className="stat-label">{s.streak === 1 ? "Tag in Folge" : "Tage in Folge"}</span>
        </div>
      </section>

      <section className="card stack" aria-labelledby="curve-h">
        <h2 className="subtitle" id="curve-h">So viele Wörter hast du gelernt</h2>
        {curve.length === 0 ? (
          <p className="lead">Sobald du ein Wort an zwei verschiedenen Tagen richtig weißt, wächst hier deine Kurve.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Lernkurve: ${s.learned} Wörter gelernt`}>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={P} x2={W - P} y1={y(maxY * f)} y2={y(maxY * f)} className="chart-grid" />
                <text x={P - 6} y={y(maxY * f) + 4} className="chart-axis" textAnchor="end">{Math.round(maxY * f)}</text>
              </g>
            ))}
            <path d={area} className="chart-area" />
            <path d={line} className="chart-line" />
            <circle cx={x(curve.length - 1)} cy={y(curve[curve.length - 1].total)} r="4" className="chart-dot" />
            <text x={P} y={H - 8} className="chart-axis">{fmtDay(curve[0].day, { day: "numeric", month: "short" })}</text>
            <text x={W - P} y={H - 8} className="chart-axis" textAnchor="end">heute</text>
          </svg>
        )}
        <p className="hint">Ein Wort zählt als gelernt, wenn du es an zwei verschiedenen Tagen richtig gewusst hast.</p>
      </section>

      <section className="card stack" aria-labelledby="act-h">
        <h2 className="subtitle" id="act-h">Geübt in den letzten 14 Tagen</h2>
        <div className="bars" role="img" aria-label="Antworten pro Tag in den letzten 14 Tagen">
          {s.activity.map((a) => (
            <div key={a.day} className="bar-col" title={`${fmtDay(a.day, { weekday: "short", day: "numeric", month: "short" })}: ${a.answers} Antworten`}>
              <div className="bar" style={{ height: `${(a.answers / maxA) * 100}%` }}>
                <div className="bar-correct" style={{ height: a.answers ? `${(a.correct / a.answers) * 100}%` : 0 }} />
              </div>
              <span className="bar-label">{fmtDay(a.day, { weekday: "narrow" })}</span>
            </div>
          ))}
        </div>
        <p className="hint">Dunkel: auf Anhieb richtig. Hell: alle Antworten.</p>
      </section>

      <section className="card stack" aria-labelledby="medal-h">
        <h2 className="subtitle" id="medal-h">Medaillen</h2>
        <ul className="medals">
          {MEDALS.map((m) => {
            const has = earned.includes(m);
            return (
              <li key={m.at} className={has ? "" : "is-locked"}>
                <span className={`medal medal-${m.tier}`}>{m.at}</span>
                <span className="medal-label">{has ? "geschafft" : `${m.at} Wörter`}</span>
              </li>
            );
          })}
        </ul>
        {next && <p className="lead">Noch {toNext} {toNext === 1 ? "Wort" : "Wörter"} bis zur nächsten Medaille.</p>}
      </section>
    </>
  );
}
