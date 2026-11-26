Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits off · launch player=good opponent=good ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 40.8% | 19.0% | 90.2% | 26.8% |
| **Titan** | 80.4% | 38.6% | 14.4% | 32.4% |
| **Tempest** | 12.0% | 81.8% | 49.0% | 69.4% |
| **Phantom** | 74.0% | 56.6% | 28.6% | 34.6% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 41.2% | 19.0% | 89.1% | 25.7% |
| **Titan** | 80.4% | 37.4% | 16.3% | 31.5% |
| **Tempest** | 10.9% | 83.7% | 47.8% | 70.2% |
| **Phantom** | 73.1% | 55.9% | 29.4% | 33.4% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 21.6 % | 28.7 % |
| Knockout finishes | 2.4 % | 2.8 % |
| Spin finishes | 69.2 % | 66.0 % |
| Draws (near-simultaneous) | 6.9 % (517) | 2.5 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 41.4 / 42.6 s | 37.6 / 41.0 s |
| P10 / P25 / P75 / P90 | 23.8 / 37.0 / 47.4 / 54.9 s | 19.5 / 34.2 / 44.4 / 48.1 s |
| Ended < 2 s / < 5 s / < 10 s | 2.1 / 2.3 / 2.5 % | 2.8 / 2.8 / 3.0 % |
| Avg damage dealt per top | 425.0 | |
| Avg collisions | 18.6 | |
| Crits per battle / % of damaging hits | 0.00 / 0.0 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 44.1 | 44.6 | 52.9 | 3.0 | 1165 / 179 / 198 | 1 / 11 / 1840 | 573.9 | 0.00 | 33.3 |
| Titan | 3500 | 42.1 | 42.7 | 50.5 | 7.4 | 264 / 0 / 1211 | 185 / 0 / 1582 | 491.6 | 0.00 | 42.0 |
| Tempest | 3500 | 54.1 | 54.9 | 45.2 | 0.7 | 0 / 0 / 1893 | 1184 / 164 / 233 | 236.9 | 0.00 | 40.4 |
| Phantom | 3500 | 50.2 | 52.8 | 41.0 | 8.8 | 294 / 0 / 1463 | 353 / 5 / 1077 | 519.8 | 0.00 | 43.4 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 40.8 | 41.6 | 17.6 | 0.0 | 49.5 % | -0.20 |
| Titan vs Titan | 500 | 38.6 | 36.2 | 25.2 | 0.0 | 51.6 % | 0.62 |
| Tempest vs Tempest | 500 | 49.0 | 46.6 | 4.4 | 0.0 | 51.3 % | 0.55 |
| Phantom vs Phantom | 500 | 34.6 | 32.2 | 33.2 | 0.0 | 51.8 % | 0.66 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 40.8 | 41.6 | 17.6 (86) | 0.0 | 44.1 | 45.7 | 29.9–57.0 | 0.0 / 3.2 / 3.8 | 0.4 | 4.2 | 77.8 | 63.8 | 289.7 HP (46.0%) | 4.0% | 324.3 / 324.6 | 0.00 | 0.0 | 7.2 | 81.3 | 0 |
| Inferno vs Titan | 19.0 | 80.4 | 0.6 (2) | 0.0 | 39.9 | 40.9 | 34.1–43.8 | 0.0 / 0.0 / 0.0 | 18.4 | 0.0 | 81.0 | 31.2 | 111.2 HP (15.8%) | 2.4% | 633.9 / 439.8 | 0.00 | 0.0 | 16.6 | 65.8 | 0 |
| Inferno vs Tempest | 90.2 | 9.8 | 0.0 (0) | 0.0 | 17.7 | 17.4 | 1.1–32.3 | 15.8 / 16.0 / 16.4 | 74.2 | 16.0 | 9.8 | 0.0 | 377.5 HP (59.4%) | 23.2% | 589.9 / 218.1 | 0.00 | 0.0 | 16.1 | 62.7 | 0 |
| Inferno vs Phantom | 26.8 | 72.2 | 1.0 (0) | 0.0 | 36.5 | 38.3 | 28.8–42.0 | 0.4 / 0.4 / 0.4 | 26.4 | 0.4 | 72.2 | 13.8 | 101.6 HP (15.1%) | 3.5% | 629.6 / 430.3 | 0.00 | 0.0 | 14.9 | 69.7 | 0 |
| Titan vs Inferno | 80.4 | 19.0 | 0.6 (1) | 0.0 | 39.7 | 41.0 | 33.6–43.8 | 0.0 / 0.0 / 0.2 | 18.6 | 0.0 | 80.8 | 27.4 | 111.6 HP (15.9%) | 2.5% | 440.0 / 633.1 | 0.00 | 0.0 | 16.5 | 65.6 | 0 |
| Titan vs Titan | 38.6 | 36.2 | 25.2 (124) | 0.0 | 46.1 | 46.1 | 44.7–47.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 74.8 | 74.8 | 509.8 HP (70.8%) | 0.4% | 206.5 / 206.4 | 0.00 | 0.0 | 3.5 | 18.2 | 0 |
| Titan vs Tempest | 14.4 | 85.6 | 0.0 (0) | 0.0 | 42.7 | 44.5 | 32.3–47.0 | 0.0 / 0.0 / 0.0 | 14.4 | 0.0 | 85.6 | 0.0 | 167.5 HP (24.1%) | 30.6% | 577.4 / 286.6 | 0.00 | 0.0 | 22.1 | 21.3 | 0 |
| Titan vs Phantom | 32.4 | 55.2 | 12.4 (58) | 0.0 | 41.7 | 42.1 | 38.9–44.8 | 0.0 / 0.0 / 0.0 | 10.0 | 0.0 | 77.6 | 77.6 | 99.9 HP (14.2%) | 1.1% | 597.4 / 608.6 | 0.00 | 0.0 | 27.4 | 31.3 | 0 |
| Tempest vs Inferno | 12.0 | 88.0 | 0.0 (0) | 0.0 | 18.4 | 18.2 | 1.0–33.4 | 16.4 / 16.8 / 18.2 | 71.2 | 16.8 | 12.0 | 0.0 | 371.8 HP (58.3%) | 24.1% | 215.8 / 584.1 | 0.00 | 0.0 | 16.0 | 62.6 | 0 |
| Tempest vs Titan | 81.8 | 18.2 | 0.0 (0) | 0.0 | 42.2 | 44.4 | 31.6–47.2 | 0.0 / 0.0 / 0.2 | 18.2 | 0.0 | 81.8 | 0.0 | 175.4 HP (25.2%) | 30.0% | 289.8 / 584.0 | 0.00 | 0.0 | 22.6 | 21.3 | 0 |
| Tempest vs Tempest | 49.0 | 46.6 | 4.4 (22) | 0.0 | 68.6 | 68.5 | 65.8–71.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 95.6 | 95.6 | 690.0 HP (100.0%) | 0.5% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 69.4 | 30.2 | 0.4 (0) | 0.0 | 46.6 | 48.5 | 36.5–51.7 | 0.0 / 0.0 / 0.0 | 30.2 | 0.0 | 69.4 | 0.0 | 166.4 HP (24.1%) | 25.8% | 323.8 / 625.3 | 0.00 | 0.0 | 38.9 | 26.9 | 0 |
| Phantom vs Inferno | 74.0 | 24.6 | 1.4 (0) | 0.0 | 36.8 | 38.6 | 29.1–42.1 | 0.6 / 0.6 / 0.6 | 24.0 | 0.6 | 74.0 | 12.8 | 105.7 HP (15.7%) | 3.7% | 424.9 / 622.7 | 0.00 | 0.0 | 14.8 | 70.1 | 0 |
| Phantom vs Titan | 56.6 | 30.6 | 12.8 (59) | 0.0 | 41.8 | 42.3 | 38.8–44.9 | 0.0 / 0.0 / 0.0 | 10.2 | 0.0 | 77.0 | 77.0 | 98.6 HP (14.1%) | 1.1% | 607.9 / 596.4 | 0.00 | 0.0 | 27.1 | 31.2 | 0 |
| Phantom vs Tempest | 28.6 | 71.0 | 0.4 (0) | 0.0 | 46.7 | 48.5 | 36.6–51.5 | 0.0 / 0.0 / 0.0 | 28.6 | 0.0 | 71.0 | 0.0 | 159.6 HP (23.1%) | 26.1% | 626.7 / 324.3 | 0.00 | 0.0 | 39.1 | 26.5 | 0 |
| Phantom vs Phantom | 34.6 | 32.2 | 33.2 (165) | 0.0 | 53.8 | 54.1 | 51.0–56.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 66.8 | 66.8 | 368.5 HP (53.4%) | 0.3% | 314.5 / 314.4 | 0.00 | 0.0 | 13.8 | 28.2 | 0 |
