Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.2 (legacy v0.2 configuration) · critical hits off · launch player=poor opponent=poor ('auto' = seeded AI distribution) · draw window 0 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 52.6% | 0.0% | 74.0% | 0.4% |
| **Titan** | 100.0% | 50.4% | 0.0% | 100.0% |
| **Tempest** | 27.2% | 100.0% | 51.0% | 39.0% |
| **Phantom** | 99.6% | 0.0% | 55.2% | 50.0% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 50.0% | 0.0% | 73.4% | 0.4% |
| **Titan** | 100.0% | 49.7% | 0.0% | 100.0% |
| **Tempest** | 26.6% | 100.0% | 50.0% | 41.8% |
| **Phantom** | 99.6% | 0.0% | 57.8% | 49.7% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 15.6 % | 20.8 % |
| Knockout finishes | 0.9 % | 1.1 % |
| Spin finishes | 83.4 % | 78.0 % |
| Draws (near-simultaneous) | 0.1 % (0) | 0.1 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 37.4 / 41.0 s | 33.3 / 29.4 s |
| P10 / P25 / P75 / P90 | 19.2 / 25.7 / 48.3 / 52.2 s | 15.7 / 24.2 / 46.1 / 48.2 s |
| Ended < 2 s / < 5 s / < 10 s | 0.7 / 0.9 / 2.6 % | 1.0 / 1.2 / 3.5 % |
| Avg damage dealt per top | 258.7 | |
| Avg collisions | 19.4 | |
| Crits per battle / % of damaging hits | 0.00 / 0.0 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 28.6 | 24.6 | 71.4 | 0.0 | 671 / 70 / 260 | 0 / 1 / 2498 | 373.8 | 0.00 | 22.8 |
| Titan | 3500 | 64.3 | 66.7 | 35.6 | 0.1 | 0 / 0 / 2252 | 0 / 0 / 1245 | 208.3 | 0.00 | 41.0 |
| Tempest | 3500 | 55.4 | 56.1 | 44.5 | 0.1 | 0 / 0 / 1939 | 1244 / 68 / 245 | 155.0 | 0.00 | 39.0 |
| Phantom | 3500 | 52.1 | 52.5 | 47.7 | 0.2 | 578 / 0 / 1246 | 4 / 0 / 1665 | 380.8 | 0.00 | 39.7 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 52.6 | 47.4 | 0.0 | 0.0 | 52.6 % | 1.16 |
| Titan vs Titan | 500 | 50.4 | 49.0 | 0.6 | 0.0 | 50.7 % | 0.31 |
| Tempest vs Tempest | 500 | 51.0 | 49.0 | 0.0 | 0.0 | 51.0 % | 0.45 |
| Phantom vs Phantom | 500 | 50.0 | 49.4 | 0.6 | 0.0 | 50.3 % | 0.13 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 52.6 | 47.4 | 0.0 (0) | 0.0 | 29.0 | 30.7 | 21.7–33.8 | 0.0 / 0.6 / 0.6 | 0.2 | 0.6 | 99.2 | 94.8 | 447.2 HP (74.5%) | 0.9% | 154.6 / 154.4 | 0.00 | 0.0 | 4.6 | 66.8 | 0 |
| Inferno vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 26.5 | 26.9 | 23.3–28.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 572.7 HP (63.6%) | 30.8% | 327.3 / 123.6 | 0.00 | 0.0 | 10.6 | 52.0 | 0 |
| Inferno vs Tempest | 74.0 | 26.0 | 0.0 (0) | 0.0 | 14.4 | 14.0 | 7.7–22.2 | 6.4 / 7.6 / 20.8 | 66.6 | 7.4 | 26.0 | 0.0 | 353.9 HP (59.0%) | 25.0% | 553.6 / 139.8 | 0.00 | 0.0 | 14.1 | 64.1 | 0 |
| Inferno vs Phantom | 0.4 | 99.6 | 0.0 (0) | 0.0 | 24.5 | 24.9 | 20.6–27.2 | 0.0 / 0.0 / 0.0 | 0.4 | 0.0 | 99.6 | 0.0 | 303.2 HP (46.7%) | 21.2% | 347.3 / 246.4 | 0.00 | 0.0 | 10.1 | 57.8 | 0 |
| Titan vs Inferno | 100.0 | 0.0 | 0.0 (0) | 0.0 | 26.4 | 26.9 | 23.5–28.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 571.5 HP (63.5%) | 30.9% | 124.1 / 328.5 | 0.00 | 0.0 | 10.7 | 52.0 | 0 |
| Titan vs Titan | 50.4 | 49.0 | 0.6 (0) | 0.0 | 50.2 | 50.3 | 48.4–52.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.4 | 99.4 | 814.3 HP (90.5%) | 0.2% | 86.2 / 86.1 | 0.00 | 0.0 | 6.6 | 6.2 | 0 |
| Titan vs Tempest | 0.0 | 100.0 | 0.0 (0) | 0.0 | 45.6 | 45.6 | 43.1–47.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 246.0 HP (41.0%) | 26.3% | 354.0 / 214.6 | 0.00 | 0.0 | 42.1 | 10.4 | 0 |
| Titan vs Phantom | 100.0 | 0.0 | 0.0 (0) | 0.0 | 46.5 | 46.8 | 43.9–48.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 496.1 HP (55.1%) | 5.8% | 206.7 / 403.9 | 0.00 | 0.0 | 28.3 | 22.5 | 0 |
| Tempest vs Inferno | 27.2 | 72.8 | 0.0 (0) | 0.0 | 14.7 | 14.2 | 7.9–22.4 | 5.2 / 6.4 / 20.6 | 66.6 | 6.2 | 27.2 | 0.0 | 349.3 HP (58.2%) | 24.9% | 140.3 / 556.2 | 0.00 | 0.0 | 14.2 | 64.3 | 0 |
| Tempest vs Titan | 100.0 | 0.0 | 0.0 (0) | 0.0 | 45.6 | 45.6 | 43.0–47.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 243.2 HP (40.5%) | 26.3% | 216.3 / 356.8 | 0.00 | 0.0 | 42.2 | 10.4 | 0 |
| Tempest vs Tempest | 51.0 | 49.0 | 0.0 (0) | 0.0 | 69.0 | 68.9 | 65.7–72.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 100.0 | 600.0 HP (100.0%) | 0.5% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 39.0 | 60.4 | 0.6 (0) | 0.0 | 41.8 | 41.3 | 31.4–50.6 | 0.0 / 0.0 / 0.0 | 60.4 | 0.0 | 39.0 | 0.0 | 301.8 HP (47.9%) | 21.8% | 187.0 / 575.5 | 0.00 | 0.0 | 37.4 | 27.7 | 0 |
| Phantom vs Inferno | 99.6 | 0.4 | 0.0 (0) | 0.0 | 24.4 | 25.1 | 20.7–27.2 | 0.0 / 0.0 / 0.0 | 0.4 | 0.0 | 99.6 | 0.0 | 301.7 HP (46.4%) | 21.2% | 247.8 / 348.9 | 0.00 | 0.0 | 10.2 | 58.1 | 0 |
| Phantom vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 46.5 | 46.8 | 43.8–48.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 495.2 HP (55.0%) | 5.7% | 404.8 / 207.0 | 0.00 | 0.0 | 28.4 | 22.5 | 0 |
| Phantom vs Tempest | 55.2 | 44.6 | 0.2 (0) | 0.0 | 42.3 | 43.0 | 31.9–50.5 | 0.0 / 0.0 / 0.0 | 55.2 | 0.0 | 44.6 | 0.0 | 278.1 HP (44.3%) | 23.8% | 574.2 / 186.6 | 0.00 | 0.0 | 37.3 | 27.3 | 0 |
| Phantom vs Phantom | 50.0 | 49.4 | 0.6 (0) | 0.0 | 51.7 | 52.1 | 49.0–53.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.4 | 99.4 | 438.5 HP (67.5%) | 0.2% | 212.7 / 212.6 | 0.00 | 0.0 | 14.0 | 21.5 | 0 |
