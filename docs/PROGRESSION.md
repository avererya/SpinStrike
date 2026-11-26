# Progression and economy (v0.4)

Source of truth in code: `src/career/config.ts` (numbers) and `src/career/progression.ts` (rules).
**A** = approved design requirement, **P** = provisional balancing value (may change).

## Currency, tops, ranks
- One spendable currency: Credits (A). Starting Credits 500 (P). No energy, repair costs, daily limits, premium currency or progression loss (A).
- Rank is account-wide and permanent (A): Bronze III/II/I, Silver, Gold, Platinum, Diamond (III/II/I each), Master (A). Only Bronze is playable.
- Bronze advancement (P): III to II 10 wins; II to I 20 further wins; Bronze I championship qualification after 30 further wins. Only victories count. After qualification you keep battling; the championship itself is a future release.

## Levels (per top)
XP from level L to L+1 = 100 + 25(L-1) (A, curve P). Cumulative XP to level 30: 13,050. Overflow carries. At level 30 progression stops; lifetime XP still accumulates. Levelling does not change stats; it unlocks upgrade ranks (A): L1 rank 2, L5 rank 4, L10 rank 6, L15 rank 8, L20 rank 9, L25 rank 10, L30 mastery milestone (nothing implemented). Levels 10 and 20 are reserved for future signature abilities.

## Upgrades (A)
Six attributes, ten ranks each, no shared cap: Health, Attack, Defense, Stamina, Speed, Critical Chance. Weight is not upgradeable.

| Rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Common cost | 100 | 200 | 350 | 500 | 750 | 1000 | 1500 | 2000 | 3000 | 4500 | 13,900 |

Full Common top (6 attributes): 83,400. Rarity multipliers Rare 1.25x, Epic 1.5x, Legendary 2x give 104,250 / 125,100 / 166,800. Per-rank costs use *cumulative* rounding (round(cum x m) minus previous), so they are integers and totals are exact. Only Common is playable in career.

Effective stat = base stat x (1 + max bonus x rank/10), linear: Health +50 %, Attack +40 %, Defense +40 %, Stamina +30 %, Speed +25 % at rank 10. Critical chance = 5 % + 2 points per rank (25 % at rank 10); critical damage stays 2x. Effective stats go through the existing stat-to-physics mapping (`src/content/derive.ts`): health to max health, attack/defense into the existing damage formula (defense keeps its diminishing returns), stamina to spin decay and impact spin resistance, speed to launch speed and traction. No artificial bonuses.

**Mapping ceiling (P):** the v0.3 mapping used to clamp stats at 100. Upgraded stats can exceed 100 (Inferno speed 106, attack 133), so the v0.3 mapping now continues linearly to 150 (`STAT_MAPPING_CEILING`). Stats <= 100 map exactly as before.

## Battle rewards (A table; multipliers see below)
Base victory reward by opponent rank: Bronze 100 Credits/50 XP, Silver 150/75, Gold 225/100, Platinum 325/150, Diamond 450/200, Master 600/250 (only Bronze implemented). Difficulty multiplier on both: Easy 0.5, Normal 1, Hard 1.5, Expert 2 (A; Expert under review). Outcome share: win 100 %/100 %, defeat 5 % Credits/10 % XP, draw 15 %/25 %, quit or abandon none. A timeout (no winner within the maximum duration) is treated as a draw. Rounding: one half-up rounding of base x difficulty % x outcome % / 10,000 in integer arithmetic.

## Quick Battle and opponents
Opponents are chosen at random from all common tops and built within bounded rank bands (P): Bronze III attributes at rank 0-1, Bronze II 0-3, Bronze I 1-5. They never scale to the player. Difficulty only changes the AI launch-quality distribution (P): Easy 45/40/13/2 %, Normal 15/40/35/10 % (the v0.3.1 default), Hard 5/25/45/25 %, Expert 0/10/40/50 % (Poor/Good/Great/Perfect).

## Economy results
See `docs/economy/v0.4-economy-report.md` (regenerate with `npx tsx scripts/economy.ts`). Summary: Credits, not XP, are the bottleneck (834 wins of Credits vs 261 wins of XP at Bronze/Normal). A Bronze-only full upgrade takes roughly 14-18 hours (measured, Normal); with the assumed higher-rank rewards the projection is about 7 hours at an 80 % win rate.
