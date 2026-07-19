"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  aiApi,
  RecommendItineraryResponse,
  RecommendationResult,
} from "@/lib/api/ai";
import { Button } from "@/components/ui/button";

type AskAiPanelProps = {
  tripId: string;
  accessToken: string;
  hasOffers: boolean;
  disabled?: boolean;
};

export function AskAiPanel({
  tripId,
  accessToken,
  hasOffers,
  disabled = false,
}: AskAiPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<RecommendItineraryResponse | null>(null);
  const [history, setHistory] = useState<RecommendItineraryResponse[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await aiApi.listRecommendations(tripId, accessToken);
        setHistory(data.items);
        if (data.items[0]) {
          setLatest(data.items[0]);
        }
      } catch {
        // History is optional on first load.
      }
    })();
  }, [tripId, accessToken]);

  async function onAsk() {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiApi.recommendItinerary({ tripId }, accessToken);
      setLatest(result);
      setHistory((prev) => [result, ...prev].slice(0, 10));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "recommendation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 border-t border-white/10 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium lowercase text-ss-text">ask ai</h2>
          <p className="mt-1 max-w-xl text-sm lowercase text-ss-muted">
            ranks attached flight and hotel offers for the cheapest sensible combo
            (gemini). search the market first, select offers, then ask — or use
            “ask ai for cheapest deal” on the search results above.
          </p>
        </div>
        <Button
          type="button"
          disabled={disabled || busy || !hasOffers}
          onClick={() => void onAsk()}
          className="rounded-full bg-ss-accent px-5 text-white lowercase hover:bg-ss-accent-hover disabled:opacity-50"
        >
          {busy ? "thinking…" : "ask ai"}
        </Button>
      </div>

      {!hasOffers ? (
        <p className="mt-4 text-sm lowercase text-ss-muted">
          attach at least one flight or hotel offer before asking for a recommendation.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm lowercase text-red-300">{error}</p>
      ) : null}

      {latest ? <RecommendationView result={latest} /> : null}

      {history.length > 1 ? (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-ss-muted">
            earlier suggestions
          </p>
          <ul className="mt-2 space-y-2 text-sm lowercase text-ss-muted">
            {history.slice(1, 4).map((item) => (
              <li key={item.id}>
                {new Date(item.createdAt).toLocaleString()} · {item.source} ·{" "}
                {item.recommendation.estimatedTotal ?? "—"}{" "}
                {item.recommendation.currency}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RecommendationView({ result }: { result: RecommendItineraryResponse }) {
  const rec: RecommendationResult = result.recommendation;

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-ss-surface-strong p-5">
      <div className="flex flex-wrap items-center gap-3 text-xs lowercase text-ss-muted">
        <span>
          source: {result.source === "rule_based" ? "rule-based fallback" : result.provider}
        </span>
        <span>·</span>
        <span>{new Date(result.createdAt).toLocaleString()}</span>
      </div>

      <div className="grid gap-3 text-sm lowercase sm:grid-cols-3">
        <div>
          <p className="text-ss-muted">flight</p>
          <p className="mt-1 text-ss-text">{rec.recommendedFlightId ?? "none"}</p>
        </div>
        <div>
          <p className="text-ss-muted">hotel</p>
          <p className="mt-1 text-ss-text">{rec.recommendedHotelId ?? "none"}</p>
        </div>
        <div>
          <p className="text-ss-muted">estimated total</p>
          <p className="mt-1 text-ss-text">
            {rec.estimatedTotal ?? "—"} {rec.currency}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ss-muted">why</p>
        <p className="mt-2 text-sm leading-relaxed text-ss-text">{rec.reasoning}</p>
      </div>

      {rec.tradeoffs ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ss-muted">tradeoffs</p>
          <p className="mt-2 text-sm leading-relaxed text-ss-muted">{rec.tradeoffs}</p>
        </div>
      ) : null}

      {rec.alternatives.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ss-muted">alternatives</p>
          <ul className="mt-2 space-y-3">
            {rec.alternatives.map((alt, index) => (
              <li
                key={`${alt.label}-${index}`}
                className="border-t border-white/5 pt-3 text-sm lowercase"
              >
                <p className="text-ss-text">{alt.label}</p>
                <p className="mt-1 text-ss-muted">{alt.rationale}</p>
                <p className="mt-1 text-xs text-ss-muted">
                  flight {alt.flightOfferId ?? "—"} · hotel {alt.hotelOfferId ?? "—"}
                  {alt.estimatedTotal != null
                    ? ` · ${alt.estimatedTotal} ${rec.currency}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
