# Vision

## The problem with everything that already exists

The contribution-graph space is saturated: snake, Pac-Man, 3D cities, Game of
Life. All of them read the same 52×7 grid of intensity values. They are visually
different and informationally identical.

Meanwhile `contributionsCollection` exposes data almost nobody visualises:
reviews given, PRs merged vs opened, repos contributed to for the first time,
restricted (private) contribution counts.

**The thesis:** the interesting signal is not how much you commit. It's the
*shape* of your activity — whether you review more than you commit, whether you
finish what you start, whether you work alone.

## The three things that make it worth building

1. **A class, not a score.** "Eres un revisor, no un committer" is something a
   person will share. A number is not. The class is derived from ratios between
   metrics, so it can't be farmed by committing more.

2. **Seniority, not level.** A level implies grind — more commits, bigger number,
   and anyone with a cron job hits max. Seniority is inferred from signals that
   are hard to fake: reviews given vs PRs opened, account age, merge acceptance
   in repos you don't own, distinct collaborators.

3. **A game frame, not a dashboard.** The card is a paused JRPG status screen —
   windows over a world — not a scene with charts underneath it. The
   contribution grid is the terrain the character stands on.

## Non-goals

- **Not a productivity metric.** No "you were 23% more productive this year."
  The framing is a character sheet, not a performance review.
- **Not a leaderboard.** No global ranking. Percentiles exist only to make tiers
  meaningful, and are never shown as "you are #4,812."
- **Not accurate about careers.** Plenty of senior engineers have thin public
  profiles. The rank is explicitly "rank earned in this campaign," not a claim
  about anyone's seniority at work. This wording is load-bearing, not a hedge.

## The honest half

Every good RPG sheet shows what you're bad at. Debuffs are part of the design,
not an afterthought:

- `lobo solitario` — high commits, near-zero reviews. "No puedes recibir asistencia."
- `puerta giratoria` — many PRs opened, few merged.
- `torre de marfil` — all activity in one repo you own.

This is the part people will argue about, which is the part they'll share.

## What success looks like for v1

Not stars. One thing: a stranger sees the card on someone's profile, and asks
what it is. If the card needs a caption to be understood, it failed.
