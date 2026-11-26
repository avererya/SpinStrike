Seeds 100001–100500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 46.0% | 32.4% | 94.2% | 42.2% |
| **Titan** | 68.6% | 45.0% | 24.6% | 44.0% |
| **Tempest** | 6.4% | 76.6% | 51.2% | 59.6% |
| **Phantom** | 62.2% | 46.0% | 41.4% | 42.4% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 44.2% | 31.4% | 93.9% | 39.5% |
| **Titan** | 67.8% | 42.9% | 24.0% | 43.6% |
| **Tempest** | 6.0% | 76.0% | 48.2% | 58.9% |
| **Phantom** | 59.6% | 44.0% | 40.8% | 41.0% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 29.3 % | 38.5 % |
| Knockout finishes | 2.9 % | 3.2 % |
| Spin finishes | 63.1 % | 56.0 % |
| Draws (near-simultaneous) | 4.8 % (327) | 2.4 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 40.7 / 42.5 s | 37.0 / 40.6 s |
| P10 / P25 / P75 / P90 | 22.1 / 35.2 / 47.4 / 54.6 s | 18.6 / 32.5 / 44.9 / 48.3 s |
| Ended < 2 s / < 5 s / < 10 s | 2.3 / 2.6 / 3.3 % | 3.0 / 3.2 / 3.8 % |
| Avg damage dealt per top | 444.1 | |
| Avg collisions | 18.2 | |
| Crits per battle / % of damaging hits | 2.63 / 4.7 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 53.7 | 54.9 | 44.2 | 2.2 | 1458 / 215 / 205 | 16 / 14 / 1516 | 589.0 | 0.75 | 32.0 |
| Titan | 3500 | 45.1 | 45.1 | 49.1 | 5.8 | 404 / 0 / 1175 | 353 / 0 / 1365 | 516.6 | 1.66 | 41.8 |
| Tempest | 3500 | 47.6 | 47.0 | 51.8 | 0.6 | 0 / 0 / 1665 | 1402 / 185 / 226 | 241.6 | 1.66 | 39.8 |
| Phantom | 3500 | 47.3 | 48.1 | 46.2 | 6.5 | 463 / 0 / 1193 | 551 / 6 / 1061 | 540.0 | 1.58 | 43.0 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 46.0 | 42.4 | 11.6 | 0.0 | 52.0 % | 0.86 |
| Titan vs Titan | 500 | 45.0 | 40.8 | 14.2 | 0.0 | 52.4 % | 1.01 |
| Tempest vs Tempest | 500 | 51.2 | 45.2 | 3.6 | 0.0 | 53.1 % | 1.37 |
| Phantom vs Phantom | 500 | 42.4 | 39.6 | 18.0 | 0.0 | 51.7 % | 0.69 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 46.0 | 42.4 | 11.6 (52) | 0.0 | 39.6 | 39.4 | 23.5–56.8 | 0.0 / 3.8 / 6.8 | 6.6 | 7.6 | 74.2 | 60.0 | 248.1 HP (39.4%) | 6.5% | 373.6 / 373.4 | 0.81 | 5.0 | 7.7 | 164.0 | 0 |
| Inferno vs Titan | 32.4 | 67.0 | 0.6 (3) | 0.0 | 39.2 | 41.1 | 31.2–44.2 | 0.0 / 0.0 / 0.0 | 30.6 | 0.0 | 68.8 | 23.8 | 109.4 HP (15.8%) | 3.0% | 656.2 / 455.5 | 1.72 | 5.1 | 16.2 | 128.1 | 0 |
| Inferno vs Tempest | 94.2 | 5.6 | 0.2 (0) | 0.0 | 16.4 | 16.8 | 1.0–29.6 | 19.0 / 19.8 / 22.4 | 74.4 | 19.8 | 5.6 | 0.0 | 400.0 HP (63.2%) | 26.4% | 569.1 / 210.7 | 1.49 | 5.1 | 14.4 | 122.3 | 0 |
| Inferno vs Phantom | 42.2 | 57.0 | 0.8 (0) | 0.0 | 35.9 | 38.2 | 26.9–41.9 | 0.8 / 0.8 / 0.8 | 41.2 | 0.8 | 57.2 | 11.0 | 114.6 HP (17.3%) | 4.3% | 643.7 / 440.5 | 1.54 | 5.2 | 14.5 | 136.0 | 0 |
| Titan vs Inferno | 68.6 | 30.4 | 1.0 (4) | 0.0 | 39.4 | 40.7 | 31.9–44.1 | 0.0 / 0.0 / 0.2 | 29.2 | 0.0 | 69.8 | 21.6 | 107.6 HP (15.5%) | 3.0% | 457.3 / 654.8 | 1.74 | 5.1 | 16.2 | 131.8 | 0 |
| Titan vs Titan | 45.0 | 40.8 | 14.2 (69) | 0.0 | 45.6 | 46.1 | 42.7–47.9 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 85.8 | 85.2 | 441.6 HP (61.3%) | 0.6% | 267.0 / 266.3 | 1.97 | 4.9 | 5.7 | 40.7 | 0 |
| Titan vs Tempest | 24.6 | 75.4 | 0.0 (0) | 0.0 | 42.2 | 45.2 | 29.9–47.9 | 0.0 / 0.0 / 0.0 | 24.6 | 0.0 | 75.4 | 0.0 | 178.2 HP (25.5%) | 29.3% | 605.6 / 300.8 | 5.36 | 5.0 | 22.3 | 41.0 | 0 |
| Titan vs Phantom | 44.0 | 42.0 | 14.0 (50) | 0.0 | 41.8 | 42.6 | 36.3–45.9 | 0.0 / 0.0 / 0.0 | 22.2 | 0.0 | 63.8 | 61.8 | 92.8 HP (13.2%) | 2.2% | 616.1 / 626.2 | 3.60 | 5.0 | 26.4 | 61.6 | 0 |
| Tempest vs Inferno | 6.4 | 93.6 | 0.0 (0) | 0.0 | 16.8 | 17.2 | 1.0–30.1 | 16.2 / 17.0 / 22.0 | 76.4 | 17.2 | 6.4 | 0.0 | 390.7 HP (61.6%) | 24.6% | 217.3 / 585.5 | 1.57 | 5.2 | 14.8 | 123.0 | 0 |
| Tempest vs Titan | 76.6 | 23.4 | 0.0 (0) | 0.0 | 42.5 | 45.3 | 29.9–48.0 | 0.0 / 0.0 / 0.0 | 23.4 | 0.0 | 76.6 | 0.0 | 179.3 HP (25.7%) | 29.7% | 298.3 / 600.2 | 5.28 | 4.9 | 22.0 | 42.7 | 0 |
| Tempest vs Tempest | 51.2 | 45.2 | 3.6 (18) | 0.0 | 68.9 | 68.9 | 64.9–72.9 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 96.4 | 89.8 | 690.0 HP (100.0%) | 0.8% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 59.6 | 40.2 | 0.2 (0) | 0.0 | 45.7 | 48.5 | 35.3–52.1 | 0.0 / 0.0 / 0.0 | 40.2 | 0.0 | 59.6 | 0.0 | 182.0 HP (26.4%) | 23.5% | 332.9 / 643.9 | 4.76 | 5.0 | 38.1 | 52.5 | 0 |
| Phantom vs Inferno | 62.2 | 36.8 | 1.0 (0) | 0.0 | 36.7 | 38.6 | 28.5–42.3 | 0.4 / 0.4 / 0.4 | 36.4 | 0.4 | 62.2 | 10.8 | 110.9 HP (16.6%) | 4.0% | 438.6 / 640.0 | 1.53 | 5.2 | 14.4 | 138.8 | 0 |
| Phantom vs Titan | 46.0 | 43.2 | 10.8 (41) | 0.0 | 41.9 | 42.6 | 36.5–46.0 | 0.0 / 0.0 / 0.0 | 21.4 | 0.0 | 67.8 | 65.0 | 89.6 HP (12.7%) | 2.1% | 628.0 / 614.6 | 3.60 | 4.9 | 26.5 | 62.1 | 0 |
| Phantom vs Tempest | 41.4 | 58.2 | 0.4 (0) | 0.0 | 46.1 | 48.9 | 35.9–52.4 | 0.0 / 0.0 / 0.0 | 41.4 | 0.0 | 58.2 | 0.0 | 188.5 HP (27.3%) | 22.8% | 641.7 / 331.1 | 4.79 | 5.0 | 38.0 | 52.7 | 0 |
| Phantom vs Phantom | 42.4 | 39.6 | 18.0 (90) | 0.0 | 53.0 | 53.5 | 48.3–56.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 82.0 | 81.6 | 321.4 HP (46.6%) | 0.5% | 361.3 / 360.3 | 2.26 | 5.0 | 14.8 | 59.3 | 0 |
