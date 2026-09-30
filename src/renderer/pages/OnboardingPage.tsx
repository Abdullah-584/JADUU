import { useEffect, useState } from "react";
import { JaduuMark } from "../components/Logo";
import { useOllamaStore } from "../stores/ollamaStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useUiStore } from "../stores/uiStore";
import { useChatStore } from "../stores/chatStore";
import { IconArrowLeft, IconCheck, IconRefresh, IconSparkle } from "../components/icons";

type Step = "welcome" | "ollama" | "model";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const status = useOllamaStore((s) => s.status);
  const models = useOllamaStore((s) => s.models);
  const refresh = useOllamaStore((s) => s.refresh);
  const refreshModels = useOllamaStore((s) => s.refreshModels);
  const checking = useOllamaStore((s) => s.checking);
  const updateSettings = useSettingsStore((s) => s.update);
  const setOnboarded = useUiStore((s) => s.setOnboarded);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const [chosen, setChosen] = useState<string>("");

  useEffect(() => {
    if (step === "ollama") {
      void refresh(true);
    }
    if (step === "model") {
      void refreshModels(true);
    }
  }, [step, refresh, refreshModels]);

  const online = status?.online ?? false;

  const finish = async () => {
    const model = chosen || models[0]?.name || "";
    if (model) {
      await updateSettings({ defaultModel: model });
      setSelectedModel(model);
    }
    await setOnboarded(true);
  };

  return (
    <div className="flex h-full items-center justify-center bg-paper p-6">
      <div className="w-full max-w-md animate-scale-in rounded-3xl border border-line bg-surface p-8 shadow-soft">
        {step === "welcome" ? (
          <div className="flex flex-col items-center text-center">
            <JaduuMark size={72} />
            <h1 className="mt-5 text-2xl font-semibold tracking-[0.22em]">JADUU</h1>
            <p className="mt-1.5 text-sm text-txt-2">Apki soch ka digital saathi.</p>
            <ul className="mt-6 space-y-2 text-sm text-txt-2">
              <li className="flex items-center justify-center gap-2">
                <IconSparkle size={13} className="text-accent" /> Private AI
              </li>
              <li className="flex items-center justify-center gap-2">
                <IconSparkle size={13} className="text-accent" /> Runs on your computer
              </li>
              <li className="flex items-center justify-center gap-2">
                <IconSparkle size={13} className="text-accent" /> Powered by Ollama
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setStep("ollama")}
              className="mt-8 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink transition-transform hover:brightness-110 active:scale-[0.99]"
            >
              Get Started
            </button>
          </div>
        ) : null}

        {step === "ollama" ? (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setStep("welcome")}
              className="mb-4 inline-flex w-fit items-center gap-1 text-xs text-txt-3 hover:text-txt-1"
            >
              <IconArrowLeft size={12} /> Back
            </button>
            <h2 className="text-lg font-semibold">Checking Ollama…</h2>
            <p className="mt-1 text-sm text-txt-2">
              JADUU talks to a local Ollama server at{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">http://localhost:11434</code>
            </p>

            <div className={`mt-6 rounded-xl border p-4 ${online ? "border-ok/40 bg-ok/5" : "border-line bg-surface-2"}`}>
              {checking && !status ? (
                <div className="text-sm text-txt-2">Connecting…</div>
              ) : online ? (
                <div className="flex items-center gap-2 text-sm text-ok">
                  <IconCheck size={15} /> Ollama is ready {status?.version ? `(v${status.version})` : ""}
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-txt-1">Ollama is not running.</div>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-txt-2">
                    <li>
                      Install Ollama from <span className="text-accent">ollama.com/download</span>
                    </li>
                    <li>Start the Ollama app (it runs in your system tray)</li>
                    <li>Pull a model in a terminal: <code className="rounded bg-surface-3 px-1">ollama pull llama3.2</code></li>
                    <li>Come back and retry — JADUU never sends your data anywhere else</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void refresh(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm text-txt-2 transition-colors hover:text-txt-1"
              >
                <IconRefresh size={13} /> Retry
              </button>
              <button
                type="button"
                disabled={!online}
                onClick={() => setStep("model")}
                className="flex-1 rounded-xl bg-accent py-2 text-sm font-medium text-accent-ink transition-transform hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "model" ? (
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold">Choose your AI model</h2>
            <p className="mt-1 text-sm text-txt-2">
              These are the models installed on your machine. You can switch anytime.
            </p>
            <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {models.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface-2 p-4 text-xs leading-relaxed text-txt-2">
                  No models installed yet. Open a terminal and run:
                  <pre className="mt-2 rounded-lg bg-surface-3 p-2.5 text-[11px]">ollama pull qwen3</pre>
                  Then click Refresh.
                </div>
              ) : (
                models.map((model) => (
                  <label
                    key={model.name}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                      chosen === model.name
                        ? "border-accent bg-accent-soft"
                        : "border-line hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                      checked={chosen === model.name}
                      onChange={() => setChosen(model.name)}
                    />
                    <span className="flex-1 text-txt-1">{model.name}</span>
                    {model.size ? (
                      <span className="text-xs text-txt-3">{(model.size / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                    ) : null}
                  </label>
                ))
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void refreshModels(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm text-txt-2 transition-colors hover:text-txt-1"
              >
                <IconRefresh size={13} /> Refresh
              </button>
              <button
                type="button"
                disabled={models.length === 0}
                onClick={() => void finish()}
                className="flex-1 rounded-xl bg-accent py-2 text-sm font-medium text-accent-ink transition-transform hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
              >
                Start using JADUU
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
