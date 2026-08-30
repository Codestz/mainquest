/**
 * The campaign state file.
 *
 * docs/07#2 decided class stability as freeze-after-qualification, which needs
 * exactly one piece of persistence. This is it, and it is deliberately a small
 * JSON file committed beside the SVGs — no backend, no database.
 *
 *   { "campaign": 2026, "class": "healer", "lockedAt": "2026-03-04", "seal": "..." }
 *
 * Three phases:
 *
 *   provisional  < 100 contributions   class recomputed every run
 *   locked       >= 100 contributions  class frozen for the rest of the campaign
 *   rollover     new campaign          recompute, with margin hysteresis
 *
 * Why not freeze from run one: the first run of a campaign is January, when the
 * sample is nearly nothing, so you would lock a class off noise. Why not pure
 * hysteresis: it still drifts, just slower, and someone near a boundary flips
 * two or three times a year until the identity is worth nothing.
 */

import { classifyStable, isClassName, type ClassName, type Percentiles } from '../derive.js';

/** Contributions needed before the class stops moving (docs/07#2). */
export const QUALIFYING_CONTRIBUTIONS = 100;

export interface CampaignState {
  campaign: number;
  class: ClassName;
  /** ISO date the class was frozen. Absent while provisional. */
  lockedAt?: string;
  seal: string;
}

export interface Resolution {
  klass: ClassName;
  subclass: ClassName;
  locked: boolean;
  /** What to write back. Undefined when nothing changed. */
  next: CampaignState;
}

/**
 * Read a state file that may be anything at all.
 *
 * It is committed to a user's own repository, so it can be hand-edited, merged
 * badly, or left over from an older version. Every field is therefore checked
 * rather than trusted: an unknown class name indexed blindly into the archetype
 * table yields a NaN cosine and silently flips the class, which is precisely
 * the bug docs/07#2 warns about.
 */
export function parseState(raw: string | null): CampaignState | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o['campaign'] !== 'number' || !Number.isInteger(o['campaign'])) return null;
  if (!isClassName(o['class'])) return null;
  return {
    campaign: o['campaign'],
    class: o['class'],
    ...(typeof o['lockedAt'] === 'string' ? { lockedAt: o['lockedAt'] } : {}),
    seal: typeof o['seal'] === 'string' ? o['seal'] : '',
  };
}

export function resolveClass(args: {
  p: Percentiles;
  campaign: number;
  totalContributions: number;
  seal: string;
  previous: CampaignState | null;
  today: string;
  /**
   * Whether this profile may be frozen at all. False when the card declines to
   * name a class — mostly-sealed or no-signal accounts have nothing to freeze,
   * and locking an invented class would hold it for a whole campaign.
   */
  freezable?: boolean;
}): Resolution {
  const { p, campaign, totalContributions, seal, previous, today } = args;
  const freezable = args.freezable ?? true;

  // A different campaign is a fresh character sheet. Hysteresis applies across
  // the boundary so a borderline profile does not flip every January, but the
  // freeze itself does not carry over.
  const sameCampaign = previous?.campaign === campaign;
  const carried = previous && previous.campaign === campaign - 1 ? previous.class : null;

  const qualified = freezable && totalContributions >= QUALIFYING_CONTRIBUTIONS;
  const alreadyLocked = Boolean(sameCampaign && previous?.lockedAt);

  // Once locked, the stored class IS the answer — no recomputation, so a
  // late-campaign shift in the data cannot move it.
  if (alreadyLocked && previous) {
    const [, runnerUp] = classifyStable(p, previous.class);
    return {
      klass: previous.class,
      subclass: runnerUp,
      locked: true,
      next: previous,
    };
  }

  const [klass, subclass] = classifyStable(p, sameCampaign ? (previous?.class ?? null) : carried);

  return {
    klass,
    subclass,
    locked: qualified,
    next: {
      campaign,
      class: klass,
      ...(qualified ? { lockedAt: today } : {}),
      seal,
    },
  };
}

/** Stable serialisation — key order fixed so an unchanged state is byte-identical. */
export function serialiseState(s: CampaignState): string {
  const ordered: Record<string, unknown> = { campaign: s.campaign, class: s.class };
  if (s.lockedAt) ordered['lockedAt'] = s.lockedAt;
  ordered['seal'] = s.seal;
  return JSON.stringify(ordered, null, 2) + '\n';
}
