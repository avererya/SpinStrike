Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0.1 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 47.6% | 33.8% | 71.0% | 42.2% |
| **Titan** | 68.4% | 47.4% | 28.4% | 46.4% |
| **Tempest** | 28.4% | 66.0% | 49.4% | 51.2% |
| **Phantom** | 55.0% | 49.6% | 51.8% | 48.0% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 46.7% | 32.6% | 71.3% | 43.2% |
| **Titan** | 67.0% | 47.2% | 31.2% | 45.1% |
| **Tempest** | 28.6% | 68.8% | 49.3% | 49.6% |
| **Phantom** | 55.9% | 49.0% | 50.3% | 46.1% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 28.9 % | 38.1 % |
| Knockout finishes | 2.9 % | 3.3 % |
| Spin finishes | 65.9 % | 57.4 % |
| Draws (near-simultaneous) | 2.3 % (132) | 1.2 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 40.1 / 41.9 s | 37.0 / 39.9 s |
| P10 / P25 / P75 / P90 | 25.6 / 34.9 / 46.7 / 54.5 s | 22.7 / 32.6 / 43.8 / 46.9 s |
| Ended < 2 s / < 5 s / < 10 s | 2.3 / 2.7 / 2.9 % | 3.1 / 3.3 / 3.3 % |
| Avg damage dealt per top | 438.4 | |
| Avg collisions | 19.3 | |
| Crits per battle / % of damaging hits | 2.80 / 4.8 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 48.8 | 49.0 | 49.8 | 1.3 | 1275 / 217 / 217 | 13 / 18 / 1713 | 569.0 | 0.81 | 33.1 |
| Titan | 3500 | 47.7 | 47.8 | 49.7 | 2.6 | 459 / 0 / 1211 | 373 / 0 / 1366 | 507.1 | 1.74 | 41.0 |
| Tempest | 3500 | 49.1 | 49.0 | 50.7 | 0.3 | 0 / 0 / 1717 | 1338 / 190 / 246 | 257.7 | 1.83 | 38.4 |
| Phantom | 3500 | 51.2 | 51.7 | 45.7 | 3.1 | 566 / 0 / 1226 | 573 / 6 / 1021 | 527.3 | 1.67 | 42.6 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 47.6 | 45.8 | 6.6 | 0.0 | 51.0 % | 0.42 |
| Titan vs Titan | 500 | 47.4 | 47.0 | 5.6 | 0.0 | 50.2 % | 0.09 |
| Tempest vs Tempest | 500 | 49.4 | 49.2 | 1.4 | 0.0 | 50.1 % | 0.05 |
| Phantom vs Phantom | 500 | 48.0 | 44.2 | 7.8 | 0.0 | 52.1 % | 0.88 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 47.6 | 45.8 | 6.6 (26) | 0.0 | 40.6 | 41.7 | 23.1–57.6 | 0.0 / 3.6 / 6.4 | 5.8 | 7.8 | 79.8 | 62.0 | 270.5 HP (42.9%) | 6.2% | 360.7 / 361.5 | 0.83 | 5.3 | 7.5 | 165.0 | 0 |
| Inferno vs Titan | 33.8 | 65.6 | 0.6 (2) | 0.0 | 38.9 | 40.7 | 31.0–44.1 | 0.0 / 0.0 / 0.0 | 32.0 | 0.0 | 67.4 | 24.4 | 103.5 HP (15.0%) | 3.0% | 661.9 / 461.6 | 1.77 | 5.2 | 16.3 | 127.6 | 0 |
| Inferno vs Tempest | 71.0 | 28.8 | 0.2 (0) | 0.0 | 20.4 | 21.7 | 1.0–33.7 | 18.2 / 18.8 / 19.0 | 52.2 | 18.8 | 28.8 | 0.0 | 299.7 HP (47.6%) | 25.0% | 507.0 / 244.7 | 1.90 | 5.2 | 18.0 | 81.6 | 0 |
| Inferno vs Phantom | 42.2 | 56.8 | 1.0 (0) | 0.0 | 35.9 | 38.3 | 27.1–41.9 | 0.6 / 0.6 / 0.6 | 41.6 | 0.6 | 56.8 | 13.0 | 110.1 HP (16.6%) | 4.1% | 648.1 / 444.9 | 1.55 | 5.2 | 14.6 | 135.9 | 0 |
| Titan vs Inferno | 68.4 | 31.4 | 0.2 (1) | 0.0 | 39.5 | 41.1 | 32.4–44.1 | 0.0 / 0.0 / 0.0 | 30.0 | 0.0 | 69.8 | 21.4 | 107.4 HP (15.5%) | 2.9% | 456.0 / 655.9 | 1.76 | 5.2 | 16.2 | 127.6 | 0 |
| Titan vs Titan | 47.4 | 47.0 | 5.6 (27) | 0.0 | 45.6 | 46.0 | 42.5–48.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 94.4 | 94.0 | 449.4 HP (62.4%) | 0.5% | 269.3 / 269.5 | 2.04 | 5.1 | 5.8 | 37.9 | 0 |
| Titan vs Tempest | 28.4 | 71.6 | 0.0 (0) | 0.0 | 40.0 | 42.5 | 29.4–46.4 | 0.0 / 0.0 / 0.0 | 28.4 | 0.0 | 71.6 | 0.0 | 170.8 HP (26.1%) | 21.8% | 567.4 / 307.6 | 5.67 | 5.1 | 24.3 | 35.4 | 0 |
| Titan vs Phantom | 46.4 | 48.4 | 5.2 (13) | 0.0 | 42.0 | 43.1 | 36.3–46.1 | 0.0 / 0.0 / 0.0 | 22.4 | 0.0 | 72.4 | 70.8 | 96.5 HP (13.7%) | 2.0% | 611.5 / 622.0 | 3.70 | 5.1 | 25.8 | 61.2 | 0 |
| Tempest vs Inferno | 28.4 | 71.6 | 0.0 (0) | 0.0 | 20.4 | 21.4 | 1.0–34.2 | 17.4 / 19.2 / 19.6 | 52.4 | 19.2 | 28.4 | 0.0 | 302.7 HP (48.0%) | 25.2% | 243.8 / 505.2 | 1.92 | 5.2 | 18.0 | 81.0 | 0 |
| Tempest vs Titan | 66.0 | 34.0 | 0.0 (0) | 0.0 | 39.3 | 41.5 | 28.8–46.4 | 0.0 / 0.0 / 0.0 | 34.0 | 0.0 | 66.0 | 0.0 | 190.6 HP (28.9%) | 21.3% | 310.2 / 568.4 | 5.69 | 5.1 | 24.4 | 34.4 | 0 |
| Tempest vs Tempest | 49.4 | 49.2 | 1.4 (7) | 0.0 | 58.9 | 59.1 | 54.9–63.1 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 98.6 | 85.4 | 630.0 HP (100.0%) | 1.0% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 51.2 | 48.8 | 0.0 (0) | 0.0 | 45.0 | 47.0 | 35.5–51.6 | 0.0 / 0.0 / 0.0 | 48.8 | 0.0 | 51.2 | 0.0 | 194.9 HP (29.6%) | 16.7% | 349.3 / 591.7 | 5.20 | 5.1 | 40.8 | 41.9 | 0 |
| Phantom vs Inferno | 55.0 | 44.2 | 0.8 (0) | 0.0 | 35.9 | 37.9 | 26.7–42.2 | 0.6 / 0.6 / 0.6 | 43.6 | 0.6 | 55.0 | 9.4 | 118.0 HP (17.8%) | 4.2% | 441.6 / 644.3 | 1.53 | 5.1 | 14.4 | 136.1 | 0 |
| Phantom vs Titan | 49.6 | 43.8 | 6.6 (18) | 0.0 | 42.0 | 42.6 | 37.1–45.9 | 0.0 / 0.0 / 0.0 | 19.6 | 0.0 | 73.8 | 70.4 | 89.2 HP (12.7%) | 1.9% | 628.8 / 615.6 | 3.71 | 5.1 | 26.7 | 61.5 | 0 |
| Phantom vs Tempest | 51.8 | 48.0 | 0.2 (0) | 0.0 | 44.8 | 46.6 | 35.7–51.5 | 0.0 / 0.0 / 0.0 | 51.8 | 0.0 | 48.0 | 0.0 | 203.2 HP (30.7%) | 15.9% | 594.1 / 348.6 | 5.24 | 5.1 | 41.0 | 39.3 | 0 |
| Phantom vs Phantom | 48.0 | 44.2 | 7.8 (38) | 0.0 | 53.0 | 53.7 | 48.4–56.5 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 92.2 | 91.8 | 320.4 HP (46.4%) | 0.5% | 368.3 / 368.0 | 2.36 | 5.1 | 15.3 | 56.1 | 0 |
