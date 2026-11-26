Seeds 200001–200500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=perfect opponent=auto ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 71.0% | 45.6% | 97.8% | 55.0% |
| **Titan** | 72.8% | 80.8% | 35.0% | 70.8% |
| **Tempest** | 8.6% | 80.2% | 85.6% | 67.2% |
| **Phantom** | 60.4% | 68.2% | 61.6% | 79.2% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 45.0% | 36.3% | 94.6% | 46.9% |
| **Titan** | 62.9% | 45.2% | 27.4% | 47.6% |
| **Tempest** | 5.3% | 72.6% | 48.8% | 52.8% |
| **Phantom** | 52.1% | 43.3% | 47.1% | 44.2% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 31.7 % | 41.6 % |
| Knockout finishes | 3.4 % | 3.8 % |
| Spin finishes | 61.4 % | 52.7 % |
| Draws (near-simultaneous) | 3.5 % (234) | 1.9 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 40.8 / 42.7 s | 37.2 / 40.7 s |
| P10 / P25 / P75 / P90 | 21.7 / 34.7 / 47.8 / 54.6 s | 18.5 / 32.5 / 45.5 / 48.7 s |
| Ended < 2 s / < 5 s / < 10 s | 2.8 / 3.0 / 3.6 % | 3.7 / 3.8 / 4.2 % |
| Avg damage dealt per top | 449.0 | |
| Avg collisions | 18.6 | |
| Crits per battle / % of damaging hits | 2.60 / 4.6 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 60.9 | 59.3 | 37.1 | 2.0 | 1548 / 267 / 318 | 9 / 4 / 1285 | 586.5 | 0.70 | 31.7 |
| Titan | 3500 | 50.9 | 46.0 | 44.9 | 4.2 | 432 / 0 / 1351 | 412 / 0 / 1158 | 524.7 | 1.65 | 42.2 |
| Tempest | 3500 | 49.6 | 43.6 | 50.0 | 0.4 | 0 / 0 / 1735 | 1476 / 215 / 60 | 242.2 | 1.65 | 40.0 |
| Phantom | 3500 | 52.0 | 47.5 | 43.4 | 4.6 | 546 / 0 / 1275 | 611 / 13 / 895 | 545.0 | 1.55 | 43.1 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 71.0 | 19.0 | 10.0 | 0.0 | 78.9 % | 12.26 |
| Titan vs Titan | 500 | 80.8 | 9.6 | 9.6 | 0.0 | 89.4 % | 16.74 |
| Tempest vs Tempest | 500 | 85.6 | 12.0 | 2.4 | 0.0 | 87.7 % | 16.66 |
| Phantom vs Phantom | 500 | 79.2 | 9.2 | 11.6 | 0.0 | 89.6 % | 16.65 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 71.0 | 19.0 | 10.0 (45) | 0.0 | 38.3 | 37.6 | 19.2–57.6 | 0.0 / 3.2 / 7.2 | 7.2 | 8.6 | 74.2 | 53.6 | 233.0 HP (37.0%) | 7.3% | 392.0 / 385.7 | 0.80 | 4.8 | 7.9 | 164.3 | 0 |
| Inferno vs Titan | 45.6 | 53.0 | 1.4 (5) | 0.0 | 39.6 | 41.1 | 32.3–45.4 | 0.0 / 0.0 / 0.0 | 40.4 | 0.0 | 58.2 | 33.4 | 111.5 HP (16.4%) | 2.6% | 672.3 / 466.2 | 1.73 | 5.0 | 16.6 | 130.8 | 0 |
| Inferno vs Tempest | 97.8 | 2.0 | 0.2 (0) | 0.0 | 15.2 | 16.3 | 0.9–28.0 | 23.8 / 25.0 / 27.4 | 72.8 | 25.0 | 2.0 | 0.0 | 423.3 HP (67.1%) | 29.8% | 537.0 / 199.8 | 1.32 | 4.9 | 13.4 | 122.3 | 0 |
| Inferno vs Phantom | 55.0 | 43.8 | 1.2 (0) | 0.0 | 36.4 | 38.5 | 28.1–42.7 | 1.2 / 1.2 / 1.2 | 53.2 | 1.2 | 44.4 | 18.0 | 127.3 HP (19.4%) | 4.3% | 653.0 / 444.6 | 1.52 | 5.0 | 14.8 | 137.1 | 0 |
| Titan vs Inferno | 72.8 | 27.0 | 0.2 (1) | 0.0 | 39.6 | 41.3 | 32.1–44.1 | 0.0 / 0.0 / 0.0 | 27.0 | 0.0 | 72.8 | 8.2 | 112.1 HP (16.1%) | 3.6% | 451.8 / 643.9 | 1.64 | 5.0 | 15.8 | 127.6 | 0 |
| Titan vs Titan | 80.8 | 9.6 | 9.6 (47) | 0.0 | 45.5 | 46.4 | 40.8–48.5 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 90.4 | 87.2 | 405.4 HP (56.3%) | 0.8% | 309.1 / 303.2 | 2.20 | 4.9 | 7.9 | 41.6 | 0 |
| Titan vs Tempest | 35.0 | 65.0 | 0.0 (0) | 0.0 | 41.8 | 45.6 | 29.8–48.5 | 0.0 / 0.0 / 0.0 | 35.0 | 0.0 | 65.0 | 0.0 | 189.4 HP (27.0%) | 26.0% | 635.2 / 313.1 | 5.53 | 5.0 | 24.8 | 43.6 | 0 |
| Titan vs Phantom | 70.8 | 18.4 | 10.8 (48) | 0.0 | 44.1 | 45.2 | 39.0–47.3 | 0.0 / 0.0 / 0.0 | 13.0 | 0.0 | 76.2 | 74.8 | 135.2 HP (18.9%) | 1.7% | 584.4 / 587.1 | 3.32 | 4.8 | 23.8 | 60.9 | 0 |
| Tempest vs Inferno | 8.6 | 91.4 | 0.0 (0) | 0.0 | 17.1 | 17.1 | 1.0–31.1 | 17.6 / 18.0 / 20.2 | 73.4 | 18.0 | 8.6 | 0.0 | 386.4 HP (60.8%) | 26.0% | 213.9 / 578.0 | 1.49 | 5.0 | 14.7 | 122.5 | 0 |
| Tempest vs Titan | 80.2 | 19.8 | 0.0 (0) | 0.0 | 43.6 | 45.9 | 32.2–48.7 | 0.0 / 0.0 / 0.2 | 19.8 | 0.0 | 80.2 | 0.0 | 170.3 HP (24.5%) | 31.9% | 298.6 / 594.7 | 5.23 | 4.9 | 21.9 | 39.9 | 0 |
| Tempest vs Tempest | 85.6 | 12.0 | 2.4 (12) | 0.0 | 70.4 | 71.0 | 64.6–75.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 97.6 | 80.4 | 690.0 HP (100.0%) | 1.2% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 67.2 | 32.6 | 0.2 (0) | 0.0 | 46.9 | 49.3 | 36.4–52.4 | 0.0 / 0.0 / 0.0 | 32.6 | 0.0 | 67.2 | 0.0 | 167.9 HP (24.3%) | 26.5% | 328.7 / 631.6 | 4.59 | 4.9 | 37.3 | 51.3 | 0 |
| Phantom vs Inferno | 60.4 | 38.8 | 0.8 (0) | 0.0 | 35.6 | 38.3 | 26.2–42.3 | 1.4 / 1.4 / 1.4 | 37.4 | 1.4 | 60.4 | 3.4 | 121.6 HP (18.2%) | 5.6% | 434.8 / 629.4 | 1.42 | 5.0 | 14.0 | 137.9 | 0 |
| Phantom vs Titan | 68.2 | 24.4 | 7.4 (19) | 0.0 | 41.1 | 42.0 | 35.5–45.6 | 0.0 / 0.0 / 0.0 | 33.6 | 0.0 | 59.0 | 46.0 | 69.8 HP (10.0%) | 3.3% | 653.2 / 631.3 | 3.60 | 4.8 | 28.1 | 61.9 | 0 |
| Phantom vs Tempest | 61.6 | 38.4 | 0.0 (0) | 0.0 | 44.7 | 45.4 | 34.8–53.0 | 0.0 / 0.0 / 0.0 | 61.6 | 0.0 | 38.4 | 0.0 | 233.3 HP (33.8%) | 16.8% | 665.4 / 341.3 | 4.85 | 5.0 | 40.0 | 54.0 | 0 |
| Phantom vs Phantom | 79.2 | 9.2 | 11.6 (57) | 0.0 | 52.7 | 53.2 | 47.6–57.1 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 88.4 | 84.4 | 292.0 HP (42.3%) | 0.7% | 397.9 / 389.9 | 2.35 | 4.9 | 16.6 | 61.0 | 0 |
