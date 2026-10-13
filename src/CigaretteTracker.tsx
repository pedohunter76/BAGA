import React from "react";
import type { GoalMode } from "./domain";

interface CigaretteTrackerProps {
  count: number;
  dailyLimit: number;
  goalMode: GoalMode;
  onboarded: boolean;
}

export function CigaretteTracker({
  count,
  dailyLimit,
  goalMode,
  onboarded,
}: CigaretteTrackerProps) {
  const hasLimit = goalMode !== "track";
  const effectiveLimit = onboarded ? dailyLimit : dailyLimit || 10;
  const isUnlit = count === 0;
  const isExtinguished =
    !isUnlit &&
    hasLimit &&
    (effectiveLimit > 0 ? count >= effectiveLimit : count > 0);
  const isLit = !isUnlit && !isExtinguished;
  const remaining = Math.max(0, effectiveLimit - count);
  const burnRatio =
    hasLimit && effectiveLimit > 0 ? Math.min(1, count / effectiveLimit) : 0;

  // Paper length shrinks smoothly as cigarettes are smoked today
  const maxPaperLen = 175;
  const minPaperLen = 28;
  const paperLen = isUnlit
    ? maxPaperLen
    : isExtinguished
      ? minPaperLen
      : Math.max(minPaperLen, maxPaperLen * (1 - burnRatio * 0.75));

  const filterX = 14;
  const filterWidth = 54;
  const goldBandX = filterX + filterWidth;
  const goldBandWidth = 4;
  const paperX = goldBandX + goldBandWidth;
  const tipX = paperX + paperLen;
  const cigHeight = 22;
  const cigY = 32;

  return (
    <div
      className={`cigarette-tracker-container ${
        isExtinguished ? "is-extinguished" : isUnlit ? "is-unlit" : "is-lit"
      }`}
      aria-label={
        isExtinguished
          ? "Cigarette extinguished. Daily limit reached."
          : isUnlit
            ? `Unlit cigarette. 0 smoked today. ${hasLimit ? `${remaining} remaining before limit.` : "Ready to track."}`
            : `Active cigarette. ${remaining} remaining before limit.`
      }
    >
      <div className="cigarette-canvas-wrap">
        <svg
          className="cigarette-svg"
          viewBox="0 0 300 86"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-hidden="true"
        >
          <defs>
            {/* Filter cork texture gradient */}
            <linearGradient id="corkFilter" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d59a5b" />
              <stop offset="25%" stopColor="#bf7f3e" />
              <stop offset="65%" stopColor="#9a5f25" />
              <stop offset="100%" stopColor="#7a4816" />
            </linearGradient>

            {/* Gold band divider */}
            <linearGradient id="goldBand" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff2a8" />
              <stop offset="35%" stopColor="#d4af37" />
              <stop offset="70%" stopColor="#9c7a1a" />
              <stop offset="100%" stopColor="#d4af37" />
            </linearGradient>

            {/* Cigarette paper 3D cylindrical lighting */}
            <linearGradient
              id="paperGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#eaeae6" />
              <stop offset="20%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#f3f3ee" />
              <stop offset="100%" stopColor="#dcdcd6" />
            </linearGradient>

            {/* Lit burning ember gradient */}
            <radialGradient
              id="litEmber"
              cx="45%"
              cy="50%"
              r="60%"
              fx="40%"
              fy="50%"
            >
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="20%" stopColor="#fff368" />
              <stop offset="45%" stopColor="#ff6200" />
              <stop offset="80%" stopColor="#d81e00" />
              <stop offset="100%" stopColor="#501000" />
            </radialGradient>

            {/* Extinguished charcoal ash gradient */}
            <radialGradient
              id="coldAsh"
              cx="40%"
              cy="50%"
              r="60%"
              fx="35%"
              fy="50%"
            >
              <stop offset="0%" stopColor="#525252" />
              <stop offset="30%" stopColor="#363636" />
              <stop offset="75%" stopColor="#1e1e1e" />
              <stop offset="100%" stopColor="#0d0d0d" />
            </radialGradient>

            {/* Unlit fresh tobacco blend gradient */}
            <linearGradient id="unlitTobacco" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7a4e28" />
              <stop offset="50%" stopColor="#5d3718" />
              <stop offset="100%" stopColor="#43240e" />
            </linearGradient>

            {/* Burning ember glow filter */}
            <filter id="emberGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor="#ff4500"
                floodOpacity="0.9"
              />
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="8"
                floodColor="#ff8800"
                floodOpacity="0.6"
              />
            </filter>
          </defs>

          {/* Cork filter */}
          <rect
            x={filterX}
            y={cigY}
            width={filterWidth}
            height={cigHeight}
            rx={3}
            fill="url(#corkFilter)"
          />
          {/* Subtle cork specks */}
          <circle
            cx={filterX + 10}
            cy={cigY + 5}
            r={0.7}
            fill="#5e330a"
            opacity="0.6"
          />
          <circle
            cx={filterX + 22}
            cy={cigY + 14}
            r={0.8}
            fill="#5e330a"
            opacity="0.5"
          />
          <circle
            cx={filterX + 38}
            cy={cigY + 8}
            r={0.6}
            fill="#5e330a"
            opacity="0.6"
          />
          <circle
            cx={filterX + 46}
            cy={cigY + 16}
            r={0.7}
            fill="#5e330a"
            opacity="0.5"
          />

          {/* Gold band */}
          <rect
            x={goldBandX}
            y={cigY}
            width={goldBandWidth}
            height={cigHeight}
            fill="url(#goldBand)"
          />

          {/* Paper cylinder */}
          <rect
            className="cigarette-paper"
            x={paperX}
            y={cigY}
            width={paperLen}
            height={cigHeight}
            fill="url(#paperGradient)"
          />

          {/* Paper ribs / watermarks */}
          {paperLen > 40 && (
            <line
              x1={paperX + paperLen * 0.3}
              y1={cigY}
              x2={paperX + paperLen * 0.3}
              y2={cigY + cigHeight}
              stroke="#000"
              strokeOpacity="0.05"
              strokeWidth="0.8"
            />
          )}
          {paperLen > 80 && (
            <line
              x1={paperX + paperLen * 0.65}
              y1={cigY}
              x2={paperX + paperLen * 0.65}
              y2={cigY + cigHeight}
              stroke="#000"
              strokeOpacity="0.05"
              strokeWidth="0.8"
            />
          )}

          {/* Ash and Ember Tip / Unlit Tip */}
          {isExtinguished ? (
            <g className="extinguished-group">
              {/* Charred, cold extinguished ash tip */}
              <path
                className="cold-ash-tip"
                d={`M ${tipX} ${cigY} Q ${tipX + 7} ${cigY + 4} ${tipX + 8} ${cigY + cigHeight / 2} Q ${tipX + 6} ${cigY + cigHeight} ${tipX} ${cigY + cigHeight} Z`}
                fill="url(#coldAsh)"
              />
              {/* Rough charred flecks */}
              <circle cx={tipX + 4} cy={cigY + 5} r="1.2" fill="#141414" />
              <circle cx={tipX + 6} cy={cigY + 11} r="1.5" fill="#242424" />
              <circle cx={tipX + 5} cy={cigY + 17} r="1.1" fill="#111111" />

              {/* Dying extinction puff animation */}
              <g className="extinguish-puff">
                <ellipse
                  className="puff-ring-1"
                  cx={tipX + 10}
                  cy={cigY + cigHeight / 2 - 8}
                  rx="6"
                  ry="4"
                />
                <ellipse
                  className="puff-ring-2"
                  cx={tipX + 15}
                  cy={cigY + cigHeight / 2 - 16}
                  rx="8"
                  ry="5"
                />
              </g>
            </g>
          ) : isLit ? (
            <g className="ember-group">
              {/* Ash base */}
              <path
                d={`M ${tipX} ${cigY} Q ${tipX + 4} ${cigY + cigHeight / 2} ${tipX} ${cigY + cigHeight} L ${tipX + 6} ${cigY + cigHeight} Q ${tipX + 10} ${cigY + cigHeight / 2} ${tipX + 6} ${cigY} Z`}
                fill="#3a3836"
              />
              {/* Glowing Ember Cone */}
              <path
                className="glowing-ember"
                d={`M ${tipX + 4} ${cigY + 1} Q ${tipX + 15} ${cigY + cigHeight / 2} ${tipX + 4} ${cigY + cigHeight - 1} Z`}
                fill="url(#litEmber)"
                filter="url(#emberGlow)"
              />
              {/* Ambient Ember Sparks */}
              <circle
                className="ember-spark-1"
                cx={tipX + 12}
                cy={cigY + 6}
                r="1"
                fill="#ffdd44"
              />
              <circle
                className="ember-spark-2"
                cx={tipX + 15}
                cy={cigY + 15}
                r="0.8"
                fill="#ffaa00"
              />

              {/* Rising Smoke Plumes */}
              <g className="smoke-cluster">
                <path
                  className="smoke-wisp smoke-wisp-1"
                  d={`M ${tipX + 7} ${cigY + 4} C ${tipX + 16} ${cigY - 10}, ${tipX + 4} ${cigY - 22}, ${tipX + 18} ${cigY - 32}`}
                />
                <path
                  className="smoke-wisp smoke-wisp-2"
                  d={`M ${tipX + 9} ${cigY + 8} C ${tipX + 3} ${cigY - 8}, ${tipX + 14} ${cigY - 20}, ${tipX + 8} ${cigY - 30}`}
                />
                <path
                  className="smoke-wisp smoke-wisp-3"
                  d={`M ${tipX + 11} ${cigY + 12} C ${tipX + 20} ${cigY - 5}, ${tipX + 10} ${cigY - 18}, ${tipX + 22} ${cigY - 28}`}
                />
              </g>
            </g>
          ) : (
            <g className="unlit-group">
              {/* Fresh unlit cut tobacco end */}
              <ellipse
                cx={tipX + 1.5}
                cy={cigY + cigHeight / 2}
                rx={2.5}
                ry={cigHeight / 2 - 0.5}
                fill="url(#unlitTobacco)"
              />
              {/* Clean paper edge seam */}
              <line
                x1={tipX}
                y1={cigY}
                x2={tipX}
                y2={cigY + cigHeight}
                stroke="#d0d0c8"
                strokeWidth="0.8"
              />
              <circle cx={tipX + 1} cy={cigY + 6} r="0.8" fill="#4d2f16" />
              <circle cx={tipX + 2} cy={cigY + 11} r="0.9" fill="#754823" />
              <circle cx={tipX + 1} cy={cigY + 16} r="0.7" fill="#3b220e" />
            </g>
          )}
        </svg>
      </div>

      <div className="cigarette-info-panel">
        <div className="cigarette-status-header">
          <span
            className={`cigarette-status-pill ${
              isExtinguished ? "extinguished" : isUnlit ? "unlit" : "lit"
            }`}
          >
            <span
              className={`cigarette-status-dot ${
                isExtinguished ? "extinguished" : isUnlit ? "unlit" : "lit"
              }`}
            />
            {isExtinguished ? "Extinguished" : isUnlit ? "Unlit" : "Lit · Active"}
          </span>

          <strong className="cigarette-status-title">
            {isExtinguished
              ? "Daily limit reached"
              : isUnlit
                ? hasLimit
                  ? `${remaining} remaining before limit`
                  : "0 smoked today"
                : hasLimit
                  ? `${remaining} remaining before limit`
                  : "Tracking mode"}
          </strong>
        </div>

        <p className="cigarette-status-desc">
          {isExtinguished
            ? `You have reached your limit of ${effectiveLimit} stick${effectiveLimit === 1 ? "" : "s"} today. Put out and take a breath.`
            : isUnlit
              ? hasLimit
                ? "Unlit at 0 cigarettes today. Lights up active once you log your first stick and burns down toward your limit."
                : "Unlit. Lights up active once you log your first cigarette."
              : hasLimit
                ? "The cigarette burns down as you log and extinguishes once your daily limit is reached."
                : "No limit set. Record your pace with calm awareness."}
        </p>
      </div>
    </div>
  );
}
