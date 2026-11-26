Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.2 (legacy v0.2 configuration) · critical hits on · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: results.drawWindow=0.25
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 33.6% | 0.0% | 82.6% | 0.6% |
| **Titan** | 100.0% | 44.6% | 0.0% | 100.0% |
| **Tempest** | 15.8% | 99.8% | 49.2% | 31.2% |
| **Phantom** | 99.4% | 0.0% | 72.8% | 42.0% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 32.0% | 0.0% | 83.4% | 0.6% |
| **Titan** | 100.0% | 42.8% | 0.1% | 100.0% |
| **Tempest** | 16.6% | 99.9% | 48.9% | 28.9% |
| **Phantom** | 99.4% | 0.0% | 70.7% | 40.3% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 18.6 % | 24.5 % |
| Knockout finishes | 1.0 % | 1.3 % |
| Spin finishes | 75.8 % | 74.1 % |
| Draws (near-simultaneous) | 4.5 % (352) | 0.1 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 38.0 / 39.2 s | 33.7 / 29.9 s |
| P10 / P25 / P75 / P90 | 17.6 / 26.0 / 49.3 / 53.4 s | 14.8 / 24.8 / 47.3 / 49.7 s |
| Ended < 2 s / < 5 s / < 10 s | 0.8 / 1.1 / 3.6 % | 1.0 / 1.3 / 4.7 % |
| Avg damage dealt per top | 280.8 | |
| Avg collisions | 20.1 | |
| Crits per battle / % of damaging hits | 2.79 / 4.8 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 28.8 | 28.0 | 66.1 | 5.1 | 769 / 82 / 157 | 8 / 1 / 2303 | 396.9 | 0.56 | 22.7 |
| Titan | 3500 | 63.5 | 66.7 | 34.4 | 2.1 | 1 / 0 / 2223 | 0 / 0 / 1204 | 233.3 | 1.99 | 42.2 |
| Tempest | 3500 | 48.6 | 48.5 | 51.0 | 0.4 | 0 / 0 / 1700 | 1465 / 77 / 243 | 163.8 | 1.89 | 39.6 |
| Phantom | 3500 | 54.6 | 56.7 | 42.5 | 2.9 | 707 / 0 / 1204 | 5 / 1 / 1482 | 405.1 | 1.51 | 40.0 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 33.6 | 30.4 | 36.0 | 0.0 | 52.5 % | 0.89 |
| Titan vs Titan | 500 | 44.6 | 41.0 | 14.4 | 0.0 | 52.1 % | 0.87 |
| Tempest vs Tempest | 500 | 49.2 | 48.6 | 2.2 | 0.0 | 50.3 % | 0.14 |
| Phantom vs Phantom | 500 | 42.0 | 38.6 | 19.4 | 0.0 | 52.1 % | 0.85 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 33.6 | 30.4 | 36.0 (177) | 0.0 | 27.6 | 29.0 | 19.0–34.6 | 0.0 / 1.0 / 1.2 | 3.0 | 1.0 | 60.0 | 49.6 | 317.7 HP (53.0%) | 2.3% | 216.0 / 216.6 | 0.66 | 5.2 | 5.9 | 137.4 | 0 |
| Inferno vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 27.1 | 27.5 | 24.2–29.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 549.6 HP (61.1%) | 30.7% | 350.4 / 133.4 | 1.13 | 5.1 | 10.7 | 100.2 | 0 |
| Inferno vs Tempest | 82.6 | 17.4 | 0.0 (0) | 0.0 | 13.7 | 13.5 | 7.2–22.7 | 6.2 / 7.4 / 26.4 | 75.2 | 7.4 | 17.4 | 0.0 | 387.1 HP (64.5%) | 23.6% | 557.2 / 142.3 | 1.35 | 5.1 | 13.2 | 126.9 | 0 |
| Inferno vs Phantom | 0.6 | 99.4 | 0.0 (0) | 0.0 | 25.1 | 25.6 | 21.1–28.1 | 0.2 / 0.2 / 0.2 | 0.4 | 0.2 | 99.4 | 0.0 | 280.0 HP (43.1%) | 21.3% | 370.5 / 264.5 | 1.06 | 5.1 | 10.3 | 110.7 | 0 |
| Titan vs Inferno | 100.0 | 0.0 | 0.0 (0) | 0.0 | 27.0 | 27.4 | 24.7–29.3 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 547.2 HP (60.8%) | 30.9% | 134.0 / 352.8 | 1.18 | 5.3 | 10.9 | 100.8 | 0 |
| Titan vs Titan | 44.6 | 41.0 | 14.4 (70) | 0.0 | 50.9 | 51.2 | 47.1–53.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 85.6 | 85.4 | 777.2 HP (86.4%) | 0.5% | 118.9 / 118.6 | 2.85 | 5.2 | 10.7 | 12.9 | 0 |
| Titan vs Tempest | 0.0 | 100.0 | 0.0 (0) | 0.0 | 47.5 | 47.6 | 44.5–50.2 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 201.5 HP (33.6%) | 26.7% | 398.5 / 242.1 | 7.44 | 5.1 | 45.1 | 20.9 | 0 |
| Titan vs Phantom | 100.0 | 0.0 | 0.0 (0) | 0.0 | 47.8 | 48.0 | 45.3–50.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 461.6 HP (51.3%) | 5.8% | 225.6 / 438.4 | 3.86 | 5.2 | 29.3 | 45.1 | 0 |
| Tempest vs Inferno | 15.8 | 84.2 | 0.0 (0) | 0.0 | 13.4 | 13.2 | 6.8–22.5 | 5.6 / 8.4 / 30.2 | 76.2 | 8.0 | 15.8 | 0.0 | 395.1 HP (65.9%) | 23.6% | 141.4 / 555.4 | 1.40 | 5.3 | 13.0 | 129.1 | 0 |
| Tempest vs Titan | 99.8 | 0.2 | 0.0 (0) | 0.0 | 47.3 | 47.3 | 44.3–50.2 | 0.0 / 0.0 / 0.0 | 0.2 | 0.0 | 99.8 | 0.0 | 203.4 HP (33.9%) | 26.7% | 242.3 / 397.7 | 7.52 | 5.2 | 45.2 | 20.6 | 0 |
| Tempest vs Tempest | 49.2 | 48.6 | 2.2 (11) | 0.0 | 72.9 | 72.8 | 67.4–78.5 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 97.8 | 87.6 | 600.0 HP (100.0%) | 0.9% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 31.2 | 68.6 | 0.2 (0) | 0.0 | 41.3 | 39.1 | 31.2–52.3 | 0.0 / 0.0 / 0.0 | 68.6 | 0.0 | 31.2 | 0.0 | 331.4 HP (52.2%) | 20.4% | 189.2 / 582.6 | 4.37 | 5.1 | 35.6 | 56.7 | 0 |
| Phantom vs Inferno | 99.4 | 0.6 | 0.0 (0) | 0.0 | 24.9 | 25.4 | 21.3–27.9 | 0.0 / 0.0 / 0.0 | 0.6 | 0.0 | 99.4 | 0.0 | 274.9 HP (42.3%) | 21.2% | 266.5 / 376.2 | 1.11 | 5.3 | 10.3 | 112.5 | 0 |
| Phantom vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 47.8 | 48.2 | 45.1–50.3 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 460.2 HP (51.1%) | 5.7% | 439.8 / 225.0 | 3.81 | 5.1 | 29.2 | 45.4 | 0 |
| Phantom vs Tempest | 72.8 | 26.6 | 0.6 (0) | 0.0 | 41.2 | 39.4 | 31.5–52.0 | 0.0 / 0.0 / 0.0 | 72.8 | 0.0 | 26.6 | 0.0 | 349.2 HP (54.9%) | 18.4% | 585.7 / 189.3 | 4.38 | 5.1 | 35.5 | 52.1 | 0 |
| Phantom vs Phantom | 42.0 | 38.6 | 19.4 (94) | 0.0 | 51.8 | 52.6 | 47.5–55.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 80.6 | 80.2 | 387.7 HP (59.6%) | 0.5% | 258.2 / 258.0 | 2.44 | 5.1 | 16.1 | 42.2 | 0 |
