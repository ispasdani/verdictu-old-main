"use client";

// components/ghost/GhostCredits.tsx
// Credit balance display for Ghost API Mode.
//
// Currently shows mock/placeholder data.
// TODO: wire up to Convex getCreditBalance query once billing backend is live.

import { useState } from "react";
import { Zap, ShoppingCart, TriangleAlert, CircleAlert } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditBalance {
  credits: number;
  /** null = no expiry (subscription credits) */
  expiresAt: number | null;
}

// ─── Placeholder hook ─────────────────────────────────────────────────────────
// Replace the body of this hook with a real Convex useQuery call later.

function useCreditBalance(): { balance: CreditBalance | null; loading: boolean } {
  // TODO: replace with:
  //   const balance = useQuery(api.users.getCreditBalance, { clerkId: userId });
  return {
    balance: { credits: 47, expiresAt: null }, // mock value for UI dev
    loading: false,
  };
}

// ─── Buy credits modal placeholder ───────────────────────────────────────────

const CREDIT_PACKS: Array<{
  name: string;
  price: string;
  credits: number;
  perCredit: string;
  popular?: boolean;
}> = [
  { name: "Starter", price: "€5", credits: 150, perCredit: "€0.033" },
  { name: "Standard", price: "€10", credits: 350, perCredit: "€0.029", popular: true },
  { name: "Power", price: "€25", credits: 1000, perCredit: "€0.025" },
  { name: "Enterprise", price: "€100", credits: 5000, perCredit: "€0.020" },
];

function BuyCreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-foreground">Buy Ghost API Credits</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Packs */}
        <div className="p-4 space-y-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.name}
              type="button"
              onClick={() => {
                // TODO: POST /api/billing/checkout with { pack: pack.name }
                // then redirect to Stripe checkout URL
                alert("Stripe checkout not wired up yet.");
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg border transition-colors text-left ${
                pack.popular
                  ? "border-foreground/30 bg-foreground/5 hover:bg-foreground/10"
                  : "border-border hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{pack.name}</span>
                    {pack.popular && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-600 border border-indigo-200">
                        Popular
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{pack.credits} credits · {pack.perCredit}/credit</span>
                </div>
              </div>
              <span className="text-sm font-bold text-foreground">{pack.price}</span>
            </button>
          ))}
        </div>

        <div className="px-5 pb-4">
          <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
            Credits expire 12 months after purchase. Powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GhostCreditsProps {
  /** Show as inline badge (used inside the toggle) vs full widget */
  variant?: "badge" | "widget";
}

export function GhostCredits({ variant = "widget" }: GhostCreditsProps) {
  const { balance, loading } = useCreditBalance();
  const [showModal, setShowModal] = useState(false);

  const credits = balance?.credits ?? 0;
  const isLow = credits > 0 && credits < 10;
  const isEmpty = credits === 0;

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
        <span className="w-10 h-3 bg-border/60 rounded animate-pulse" />
        <span>credits</span>
      </div>
    );
  }

  // ── Badge variant (inside the toggle row) ─────────────────────────────────
  if (variant === "badge") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            isEmpty
              ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              : isLow
                ? "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"
                : "bg-secondary text-muted-foreground border border-border hover:bg-accent"
          }`}
          title={isEmpty ? "No credits left — click to buy more" : `${credits} Ghost API credits remaining`}
        >
          <Zap size={9} />
          <span>{credits}</span>
        </button>

        {showModal && <BuyCreditsModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // ── Widget variant (below the Ghost API model selector) ───────────────────
  return (
    <>
      <div className="flex items-center justify-between px-2.5 py-2 rounded-md bg-secondary/40 border border-border">
        <div className="flex items-center gap-2">
          {isEmpty ? (
            <CircleAlert size={12} className="text-red-500 shrink-0" />
          ) : isLow ? (
            <TriangleAlert size={12} className="text-amber-500 shrink-0" />
          ) : (
            <Zap size={12} className="text-amber-400 shrink-0" />
          )}
          <div>
            <span className="text-xs font-medium text-foreground">
              {isEmpty
                ? "No credits remaining"
                : `${credits} credit${credits === 1 ? "" : "s"} remaining`}
            </span>
            {isLow && !isEmpty && (
              <p className="text-[10px] text-amber-600 leading-tight">Running low</p>
            )}
            {isEmpty && (
              <p className="text-[10px] text-red-500 leading-tight">Top up to use Ghost API</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-foreground text-card hover:bg-foreground/80 transition-colors shrink-0"
        >
          <ShoppingCart size={10} />
          Buy credits
        </button>
      </div>

      {showModal && <BuyCreditsModal onClose={() => setShowModal(false)} />}
    </>
  );
}
