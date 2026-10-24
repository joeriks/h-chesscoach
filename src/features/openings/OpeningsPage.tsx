import { useCallback, useEffect, useState } from "react";
import {
  ipc,
  type DeviationGroup,
  type DrillStats,
  type FamilyStat,
  type Recommendation,
  type Repertoire,
  type RepertoireChoices,
  type StyleProfile,
  type TrendWarning,
} from "../../lib/ipc";
import { requestGame, takeOpeningsRequest } from "../../lib/navigation";
import { DrillRunner } from "./DrillRunner";
import { ExplorerTab } from "./ExplorerTab";
import { LessonViewer } from "./LessonViewer";
import { MasterDeviations } from "./MasterDeviations";
import { StylePanel } from "./StylePanel";

type Tab = "style" | "lessons" | "explorer" | "drill" | "deviations" | "stats";
const TABS: [Tab, string][] = [
  ["style", "Style & repertoire"],
  ["lessons", "Lessons"],
  ["explorer", "Master Explorer"],
  ["drill", "Drill"],
  ["deviations", "Deviations"],
  ["stats", "Your openings"],
];
const SLOTS: [Recommendation["slot"], keyof RepertoireChoices, string][] = [
  ["white", "white", "As White"],
  ["black_e4", "blackE4", "As Black vs 1.e4"],
  ["black_d4", "blackD4", "As Black vs 1.d4"],
];

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The Opening Lab v1: style and repertoire, lessons, drills, deviations and stats. */
export function OpeningsPage() {
  const [request] = useState(() => takeOpeningsRequest());
  const [tab, setTab] = useState<Tab>(() =>
    request?.drill ? "drill" : request?.lineKey ? "lessons" : "style",
  );
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [repertoires, setRepertoires] = useState<Repertoire[]>([]);
  const [choices, setChoices] = useState<RepertoireChoices | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [stats, setStats] = useState<DrillStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elite, setElite] = useState(false);
  const [trends, setTrends] = useState<TrendWarning[]>([]);
  // "Show in explorer" from a deviation opens the explorer at that position.
  const [exploreFen, setExploreFen] = useState<string | null>(null);

  const load = useCallback(() => {
    ipc
      .eliteStatus()
      .then((o) => {
        setElite(o.available);
        if (o.available) {
          ipc
            .repertoireTrends()
            .then(setTrends)
            .catch(() => setTrends([]));
        }
      })
      .catch(() => setElite(false));
    ipc
      .styleProfile()
      .then(setProfile)
      .catch((e: unknown) => setError(errorText(e)));
    ipc
      .listRepertoires()
      .then(setRepertoires)
      .catch(() => {});
    ipc
      .repertoireChoices()
      .then(setChoices)
      .catch(() => {});
    ipc
      .repertoireRecommendations()
      .then(setRecs)
      .catch(() => {});
    ipc
      .openingDrillStats()
      .then(setStats)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const choose = (slot: Recommendation["slot"], key: string | null) => {
    setError(null);
    ipc
      .chooseRepertoire(slot, key)
      .then((c) => {
        setChoices(c);
        ipc
          .openingDrillStats()
          .then(setStats)
          .catch(() => {});
      })
      .catch((e: unknown) => setError(errorText(e)));
  };

  const chosenKeys = choices
    ? [choices.white, choices.blackE4, choices.blackD4].filter(Boolean)
    : [];
  const chosen = repertoires.filter((r) => chosenKeys.includes(r.key));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Openings</h1>
        <nav className="flex rounded border border-neutral-700 text-sm" aria-label="Opening Lab">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              className={`px-3 py-1 ${tab === id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              {label}
              {id === "drill" && stats && stats.due > 0 && (
                <span className="ml-1 rounded bg-amber-700 px-1 text-xs text-white">
                  {stats.due}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {tab === "style" && (
        <div className="max-w-3xl space-y-6">
          {profile && <StylePanel profile={profile} onChange={setProfile} />}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Your repertoire
            </h2>
            {SLOTS.map(([slot, field, label]) => {
              const current = choices?.[field] ?? null;
              const options = recs.filter((r) => r.slot === slot);
              return (
                <div
                  key={slot}
                  className="rounded border border-neutral-800 p-3"
                  data-testid={`slot-${slot}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{label}</span>
                    <span className="text-sm text-neutral-400">
                      {current
                        ? (repertoires.find((r) => r.key === current)?.name ?? current)
                        : "nothing chosen yet"}
                    </span>
                    {current && (
                      <button
                        type="button"
                        onClick={() => choose(slot, null)}
                        className="ml-auto rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1.5" aria-label={`${label} options`}>
                    {options.map((o, i) => {
                      const rep = repertoires.find((r) => r.key === o.repertoire);
                      return (
                        <li
                          key={o.repertoire}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span className={i === 0 ? "text-emerald-300" : "text-neutral-200"}>
                            {i === 0 ? "Recommended: " : ""}
                            {o.name}
                          </span>
                          <span className="text-xs text-neutral-500">
                            fit {Math.round(o.fit * 100)}% · {o.reasons.join("; ")}
                            {rep ? ` · theory ${rep.theoryLoad}/5` : ""}
                          </span>
                          {current !== o.repertoire && (
                            <button
                              type="button"
                              onClick={() => choose(slot, o.repertoire)}
                              className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-medium hover:bg-emerald-600"
                            >
                              Choose
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {tab === "lessons" && (
        <LessonViewer
          repertoires={chosen.length > 0 ? chosen : repertoires}
          initialLineKey={request?.lineKey ?? null}
          trends={trends}
          withModelGames={elite}
        />
      )}

      {tab === "explorer" && (
        <ExplorerTab
          key={exploreFen ?? "start"}
          available={elite}
          initialFen={exploreFen ?? undefined}
        />
      )}

      {tab === "drill" && (
        <DrillRunner
          stats={stats}
          hasRepertoire={chosenKeys.length > 0}
          taskId={request?.drill ? request.taskId : undefined}
          onFinished={() =>
            ipc
              .openingDrillStats()
              .then(setStats)
              .catch(() => {})
          }
        />
      )}

      {tab === "deviations" && (
        <div className="space-y-6">
          <Deviations />
          <MasterDeviations
            available={elite}
            onExplore={(fen) => {
              setExploreFen(fen);
              setTab("explorer");
            }}
          />
        </div>
      )}

      {tab === "stats" && <FamilyStats />}
    </div>
  );
}

function Deviations() {
  const [items, setItems] = useState<DeviationGroup[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const load = useCallback(() => {
    ipc
      .recentRepertoireDeviations(50)
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);
  if (!items) return <p className="text-sm text-neutral-400">Loading…</p>;
  if (items.length === 0) {
    return (
      <p className="max-w-2xl text-sm text-neutral-400">
        No deviations from your repertoire in your recent games. Either you stayed in book, your
        opponents left first, or no repertoire is chosen yet (Style &amp; repertoire tab).
      </p>
    );
  }
  return (
    <ul className="max-w-3xl space-y-2" aria-label="Deviations">
      {items.map((d) => {
        const key = `${d.lineKey}#${d.ply}`;
        return (
          <li
            key={`${key}-${d.playedUci}`}
            className="rounded border border-neutral-800 p-3 text-sm"
          >
            <div className="text-neutral-400">
              {d.games === 1 ? "Once" : `In ${d.games} games`}, latest{" "}
              {d.latest.playedAt?.slice(0, 10) ?? "?"} · {d.latest.white} vs {d.latest.black}
            </div>
            <div className="mt-1">
              You left <span className="font-semibold">{d.lineName}</span> on move{" "}
              {Math.ceil(d.ply / 2)}: {d.playedSan} instead of {d.expectedSan}.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestGame(d.latest.gameId, d.ply)}
                className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
              >
                Show
              </button>
              <button
                type="button"
                disabled={added.includes(key)}
                onClick={() =>
                  ipc
                    .addOpeningDrill(d.lineKey, d.ply)
                    .then(() => setAdded((a) => [...a, key]))
                    .catch(() => {})
                }
                className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-60"
              >
                {added.includes(key) ? "Drill added" : "Add a drill"}
              </button>
              <button
                type="button"
                onClick={() =>
                  ipc
                    .keepRepertoireMove(d.lineKey, d.ply, d.playedUci)
                    .then(load)
                    .catch(() => {})
                }
                className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
              >
                Keep my move
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FamilyStats() {
  const [stats, setStats] = useState<FamilyStat[] | null>(null);
  useEffect(() => {
    ipc
      .openingFamilyStats()
      .then(setStats)
      .catch(() => setStats([]));
  }, []);
  const names: Record<string, string> = {
    A: "A · Flank openings",
    B: "B · Semi-open games",
    C: "C · Open games, French",
    D: "D · Closed, semi-closed",
    E: "E · Indian defences",
  };
  if (!stats) return <p className="text-sm text-neutral-400">Loading…</p>;
  if (stats.length === 0)
    return <p className="text-sm text-neutral-400">No games with an ECO code yet.</p>;
  return (
    <table className="max-w-3xl text-sm" aria-label="Opening families">
      <thead className="text-left text-xs uppercase tracking-wide text-neutral-400">
        <tr>
          <th className="pr-4">Family</th>
          <th className="pr-4">Games</th>
          <th className="pr-4">Score</th>
          <th className="pr-4">Win-% after move 15</th>
          <th>Most played</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => (
          <tr key={s.family} className="border-t border-neutral-800">
            <td className="py-1 pr-4">{names[s.family] ?? s.family}</td>
            <td className="pr-4">{s.games}</td>
            <td className="pr-4">{Math.round(s.score)}%</td>
            <td className="pr-4">
              {s.winAtMove15 === null ? "–" : `${Math.round(s.winAtMove15)}%`}
            </td>
            <td className="text-neutral-400">{s.mostPlayed ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
