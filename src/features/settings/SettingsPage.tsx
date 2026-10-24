import { useCallback, useEffect, useState } from "react";
import { ipc, type AppInfo, type EngineStatus } from "../../lib/ipc";
import { AboutSection } from "./AboutSection";
import { AccountsSection } from "./AccountsSection";
import { EliteSection } from "./EliteSection";
import { engineLabel } from "./engineLabel";

type Load<T> = { state: "loading" } | { state: "ok"; value: T } | { state: "error"; error: string };

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function SettingsPage({ onSetupAgain }: { onSetupAgain?: () => void }) {
  const [info, setInfo] = useState<Load<AppInfo>>({ state: "loading" });
  const [engine, setEngine] = useState<Load<EngineStatus>>({ state: "loading" });

  const loadEngine = useCallback(() => {
    ipc
      .engineStatus()
      .then((value) => setEngine({ state: "ok", value }))
      .catch((e) => setEngine({ state: "error", error: errorText(e) }));
  }, []);

  const checkEngineAgain = () => {
    setEngine({ state: "loading" });
    loadEngine();
  };

  useEffect(() => {
    ipc
      .appInfo()
      .then((value) => setInfo({ state: "ok", value }))
      .catch((e) => setInfo({ state: "error", error: errorText(e) }));
    loadEngine();
  }, [loadEngine]);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <AccountsSection />

      <EliteSection />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Engine</h2>
          <button
            type="button"
            onClick={checkEngineAgain}
            className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
          >
            Check again
          </button>
        </div>
        {engine.state === "loading" && <p className="text-neutral-400">Checking engine…</p>}
        {engine.state === "error" && <p className="text-red-400">{engine.error}</p>}
        {engine.state === "ok" && (
          <div className="space-y-1">
            <p
              data-testid="engine-status"
              className={engine.value.ready ? "text-emerald-400" : "text-red-400"}
            >
              {engineLabel(engine.value)}
            </p>
            <p className="break-all text-xs text-neutral-500">
              {engine.value.source === "bundled" ? "Bundled sidecar" : "Custom path"}:{" "}
              {engine.value.path}
            </p>
            {engine.value.ready && (
              <p className="text-xs text-neutral-500">
                UCI handshake in {engine.value.elapsedMs} ms, {engine.value.optionCount} options
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Storage</h2>
        {info.state === "loading" && <p className="text-neutral-400">Loading…</p>}
        {info.state === "error" && <p className="text-red-400">{info.error}</p>}
        {info.state === "ok" && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-400">Data folder</dt>
            <dd className="break-all">{info.value.dataDir}</dd>
            <dt className="text-neutral-400">Database</dt>
            <dd className="break-all">{info.value.dbPath}</dd>
            <dt className="text-neutral-400">Schema version</dt>
            <dd>{info.value.schemaVersion}</dd>
            <dt className="text-neutral-400">App version</dt>
            <dd>{info.value.version}</dd>
          </dl>
        )}
      </section>

      <AboutSection
        version={info.state === "ok" ? info.value.version : null}
        onSetupAgain={onSetupAgain ?? (() => {})}
      />
    </div>
  );
}
