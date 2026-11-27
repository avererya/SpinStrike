# Career save schema (v0.5, schemaVersion 2)

Code: `src/career/save.ts` (types, validation, migration), `src/career/store.ts` (persistence), `src/career/history.ts` (statistics).

## Storage
Browser `localStorage`, tied to the browser and device:
- `spinstrike.career.v1` main save (JSON).
- `spinstrike.career.v1.backup` previous good save, written before every commit.
- `spinstrike.career.v1.corrupt` unreadable data kept for recovery (never deleted automatically).
- `spinstrike.prefs.v1` UI preference (last difficulty). Sandbox state is not persisted and never shares these keys.
The game version never resets a career.

## Shape
```
CareerSave {
  format: 'spinstrike-career', schemaVersion: 2,
  careerId, createdAt, updatedAt, createdWithVersion, revision,
  credits, rank { id, wins, championshipQualified },
  totals { battles, wins, creditsEarned, xpEarned },
  activeTopId, unlocks { stadiums[] }, claimedBattleIds[] (last 500),
  tops: OwnedTop[] }
OwnedTop { instanceId, definitionId, rarity, acquiredAt, level, xp, lifetimeXp,
  upgrades { health, attack, defense, stamina, speed, critChance: 0-10 },
  stats: TopStats, equipment {} (reserved), cosmetics {} (reserved),
  launchAim? { direction: -45..45, tilt: 0..30 } (v0.4.1, optional) }
TopStats { battles, wins, losses, draws, streak, bestStreak, winsByFinish, lossesByFinish,
  fastestWin, longestBattle, damageDealt, damageReceived, critsLanded, creditsEarned, xpEarned,
  launches{poor..perfect}, vsClass{}, vsTop{}, byStadium{} (Tally each), tactics: TacticalLifetime (v0.5),
  recent: BattleRecord[<=100] }
TacticalLifetime { battles, boostsUsed, bracesUsed, staminaSpent (sum of % of launch energy), braceImpacts,
  damagePrevented, boostsToHit, boostKnockouts, noAbilityBattles, noAbilityWins }
BattleRecord { id, at, seed, stadiumId, difficulty, playerRankId, opponent{topId,topClass,rankId,ranks},
  result, finish, duration, launch, opponentLaunch, damageDealt, damageReceived, crits, rewards{credits,xp},
  ruleset? (v0.4.1+), aim? {direction,tilt} (v0.4.1+), opponentAim? {direction,tilt} (v0.4.1+),
  tactical? { player: TacticalSide, opponent: TacticalSide } (v0.5+),
  launchSettings? { opponentAimDirection: [min,max], opponentAimTilt: [min,max] } (v0.5+) }
TacticalSide { boosts, braces, boostsLeft, bracesLeft, staminaSpent, braceImpacts, damagePrevented, boostsToHit, boostKnockout }
```
Instance ids (`top_*`, `battle_*`) are unique; definition ids (`inferno`) reference content. New tops, stadiums and equipment add keys, not schema changes.

## v0.4.1 additions (no schema change)
All three additions are **optional fields**, so the schema stays at version 1 and v0.4.0 saves load unchanged:
- `OwnedTop.launchAim`: the player's last confirmed launch aim with that top. Absent until the player first aims. Invalid values are dropped on load.
- `BattleRecord.ruleset`: the physics/stat ruleset the battle was played under (`'v0.4.1'`). Written for new records only. Records from v0.4.0 have no `ruleset` and are **never back-filled**, because we cannot know for certain how they were played; an absent ruleset means "v0.4.0 or earlier".
- `BattleRecord.aim` / `opponentAim`: both tops' launch aims. New records only.

Effective stats are not stored: they are recalculated from `upgrades` and the current base stats whenever needed, so v0.4.0 tops get v0.4.1 base stats with their ranks unchanged. Historical records (durations, damage, rewards) are left exactly as they were.

## Loading
raw JSON, then `migrateSave` (applies `MIGRATIONS[n]` for each n up to the current version; a save from a newer schema is refused and left untouched), then `validateSave` (sanitises: clamps levels/ranks/XP, drops unknown tops, repairs the active top and rank, bounds recent history; no valid top is a fatal error). Problems are reported as warnings in Settings. If the main save is unreadable the backup is restored and the bad data is kept under the corrupt key.

## Transactions
Every change (`startCareer`, `upgrade`, `settleBattle`, `importJson`) builds a complete next state and commits it in one write; credits, XP, level, rank, statistics and the claimed battle id change together. Settling a battle id again returns the original summary and changes nothing; claimed ids survive reloads. A storage failure keeps the in-memory career and shows an error.

## Export / import
Settings exports `{format:'spinstrike-career-export', exportVersion:1, exportedAt, gameVersion, save}` as JSON (download or clipboard). Import validates (and migrates) first, shows a summary, and replaces the career only after explicit confirmation. Reset requires typing RESET.

## v0.5 (schema 2)
- **Migration 1 → 2** (`MIGRATIONS[1]` in `src/career/save.ts`): every owned top gets `stats.tactics` with all counters at zero. Nothing else changes.
- **No back-filling:**
  - Existing battle records are kept byte-for-byte and get no `tactical` or `launchSettings`.
  - Lifetime tactical statistics count only battles played with abilities, so `tactics.battles` can be lower than `battles`.
- **New records:**
  - Records of battles played with abilities carry `ruleset: 'v0.5.0'` (otherwise the physics ruleset).
  - They also carry `tactical` (per side: usage, remaining charges, stamina spent, braced impacts, damage prevented, boost→hit, boost→KO) and the opponent's aim range (`launchSettings`).
- **Attribution windows** (simulation time):
  - boost→hit is a damaging hit between the two tops within 1.0 s of a boost;
  - boost→KO is the opponent knocked out within 1.5 s of the player's last boost, with a damaging hit in between.
- **Loading old saves:** a schema-1 save (v0.4.0 or v0.4.1) migrates automatically on load and on import. A schema-2 save opened by an older build is refused as "newer" and is never overwritten.
- **Separation:** sandbox battles never write career statistics.
