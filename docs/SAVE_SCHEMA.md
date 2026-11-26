# Career save schema (v0.4, schemaVersion 1)

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
  format: 'spinstrike-career', schemaVersion: 1,
  careerId, createdAt, updatedAt, createdWithVersion, revision,
  credits, rank { id, wins, championshipQualified },
  totals { battles, wins, creditsEarned, xpEarned },
  activeTopId, unlocks { stadiums[] }, claimedBattleIds[] (last 500),
  tops: OwnedTop[] }
OwnedTop { instanceId, definitionId, rarity, acquiredAt, level, xp, lifetimeXp,
  upgrades { health, attack, defense, stamina, speed, critChance: 0-10 },
  stats: TopStats, equipment {} (reserved), cosmetics {} (reserved) }
TopStats { battles, wins, losses, draws, streak, bestStreak, winsByFinish, lossesByFinish,
  fastestWin, longestBattle, damageDealt, damageReceived, critsLanded, creditsEarned, xpEarned,
  launches{poor..perfect}, vsClass{}, vsTop{}, byStadium{} (Tally each), recent: BattleRecord[<=100] }
BattleRecord { id, at, seed, stadiumId, difficulty, playerRankId, opponent{topId,topClass,rankId,ranks},
  result, finish, duration, launch, opponentLaunch, damageDealt, damageReceived, crits, rewards{credits,xp} }
```
Instance ids (`top_*`, `battle_*`) are unique; definition ids (`inferno`) reference content. New tops, stadiums and equipment add keys, not schema changes.

## Loading
raw JSON, then `migrateSave` (applies `MIGRATIONS[n]` for each n up to the current version; a save from a newer schema is refused and left untouched), then `validateSave` (sanitises: clamps levels/ranks/XP, drops unknown tops, repairs the active top and rank, bounds recent history; no valid top is a fatal error). Problems are reported as warnings in Settings. If the main save is unreadable the backup is restored and the bad data is kept under the corrupt key.

## Transactions
Every change (`startCareer`, `upgrade`, `settleBattle`, `importJson`) builds a complete next state and commits it in one write; credits, XP, level, rank, statistics and the claimed battle id change together. Settling a battle id again returns the original summary and changes nothing; claimed ids survive reloads. A storage failure keeps the in-memory career and shows an error.

## Export / import
Settings exports `{format:'spinstrike-career-export', exportVersion:1, exportedAt, gameVersion, save}` as JSON (download or clipboard). Import validates (and migrates) first, shows a summary, and replaces the career only after explicit confirmation. Reset requires typing RESET.
