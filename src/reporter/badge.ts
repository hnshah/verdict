/**
 * SVG score badge generator.
 *
 * Outputs a Shields.io-style pill: `verdict | 8.7/10` with a colour band
 * by score. Designed to be committed to a repo and referenced from a
 * README, OR served from a static dashboard URL.
 */

import type { RunResult } from '../types/index.js'

export interface BadgeOptions {
  /** Label on the left side. Default 'verdict'. */
  label?: string
  /** Override score; otherwise computed from top model in result. */
  score?: number
  /** Show the winning model name on the right (e.g. "qwen2.5:7b 8.7"). */
  showModel?: boolean
}

/**
 * Generate an SVG badge from a run result. Pulls the top model's score
 * and renders a 2-section pill.
 */
export function generateBadge(result: RunResult, opts: BadgeOptions = {}): string {
  const sorted = result.models
    .map(id => result.summary[id])
    .filter(s => s && s.cases_run > 0)
    .sort((a, b) => b.avg_total - a.avg_total)
  const top = sorted[0]

  const label = opts.label ?? 'verdict'
  const score = opts.score ?? (top ? top.avg_total : 0)
  const value = opts.showModel && top
    ? `${top.model_id} ${score.toFixed(1)}`
    : `${score.toFixed(1)}/10`

  return renderBadgeSVG(label, value, colorFor(score))
}

/**
 * Static badge with arbitrary label/value/color — useful for "no data yet"
 * placeholders or custom variations.
 */
export function generateStaticBadge(label: string, value: string, color = '#555'): string {
  return renderBadgeSVG(label, value, color)
}

function colorFor(score: number): string {
  if (score >= 9) return '#22c55e' // bright green
  if (score >= 8) return '#65a30d' // green
  if (score >= 7) return '#a3b800' // yellow-green
  if (score >= 6) return '#eab308' // yellow
  if (score >= 5) return '#f97316' // orange
  return '#dc2626' // red
}

/**
 * Render the SVG. Uses a fixed 11px Verdana font; widths are computed via
 * a simple character-width estimate to keep the badge tight without
 * needing canvas measurement.
 */
function renderBadgeSVG(label: string, value: string, valueColor: string): string {
  const labelWidth = textWidth(label) + 10
  const valueWidth = textWidth(value) + 10
  const totalWidth = labelWidth + valueWidth

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escape(label)}: ${escape(value)}">`,
    `<title>${escape(label)}: ${escape(value)}</title>`,
    `<linearGradient id="s" x2="0" y2="100%">`,
    `<stop offset="0" stop-color="#fff" stop-opacity=".7"/>`,
    `<stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>`,
    `<stop offset=".9" stop-color="#000" stop-opacity=".3"/>`,
    `<stop offset="1" stop-color="#000" stop-opacity=".5"/>`,
    `</linearGradient>`,
    `<clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${labelWidth}" height="20" fill="#555"/>`,
    `<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${valueColor}"/>`,
    `<rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110" style="-webkit-text-size-adjust:none">`,
    `<text aria-hidden="true" x="${(labelWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">${escape(label)}</text>`,
    `<text x="${(labelWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${(labelWidth - 10) * 10}">${escape(label)}</text>`,
    `<text aria-hidden="true" x="${(labelWidth + valueWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueWidth - 10) * 10}">${escape(value)}</text>`,
    `<text x="${(labelWidth + valueWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${(valueWidth - 10) * 10}">${escape(value)}</text>`,
    `</g>`,
    `</svg>`,
  ].join('')
}

/**
 * Estimate pixel width of a string at 11px Verdana. The constants come
 * from average character widths and match Shields.io's measurement
 * closely enough for visual purposes — no canvas API required.
 */
function textWidth(s: string): number {
  // Roughly: lowercase ~6px, uppercase/digits ~7px, narrow chars ~3px.
  let w = 0
  for (const c of s) {
    if (/[A-Z0-9]/.test(c)) w += 7
    else if (/[a-z]/.test(c)) w += 6
    else if (/[.:/]/.test(c)) w += 3
    else w += 5
  }
  return Math.max(w, 20) // minimum width
}
