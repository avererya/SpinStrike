Seeds 200001–200500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 43.8% | 28.6% | 94.8% | 42.8% |
| **Titan** | 63.2% | 42.4% | 21.8% | 41.8% |
| **Tempest** | 7.2% | 73.6% | 47.8% | 55.2% |
| **Phantom** | 58.4% | 45.6% | 44.2% | 41.4% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 44.6% | 32.3% | 93.6% | 42.0% |
| **Titan** | 67.0% | 41.3% | 24.1% | 42.6% |
| **Tempest** | 6.2% | 75.9% | 47.5% | 55.4% |
| **Phantom** | 57.6% | 45.8% | 44.4% | 40.7% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 29.6 % | 39.2 % |
| Knockout finishes | 2.9 % | 3.5 % |
| Spin finishes | 62.6 % | 55.1 % |
| Draws (near-simultaneous) | 4.9 % (337) | 2.2 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 40.8 / 42.4 s | 36.9 / 40.5 s |
| P10 / P25 / P75 / P90 | 22.6 / 35.1 / 47.3 / 54.6 s | 19.1 / 32.6 / 44.5 / 48.1 s |
| Ended < 2 s / < 5 s / < 10 s | 2.4 / 2.7 / 3.3 % | 3.3 / 3.5 / 4.0 % |
| Avg damage dealt per top | 443.2 | |
| Avg collisions | 18.4 | |
| Crits per battle / % of damaging hits | 2.59 / 4.6 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 54.2 | 56.0 | 43.9 | 1.9 | 1461 / 220 / 217 | 10 / 11 / 1514 | 587.4 | 0.71 | 32.2 |
| Titan | 3500 | 44.3 | 44.6 | 49.7 | 6.0 | 400 / 0 / 1149 | 362 / 0 / 1379 | 516.4 | 1.64 | 41.8 |
| Tempest | 3500 | 46.1 | 45.8 | 53.1 | 0.8 | 0 / 0 / 1614 | 1426 / 195 / 236 | 242.8 | 1.65 | 39.7 |
| Phantom | 3500 | 48.1 | 49.3 | 45.7 | 6.1 | 500 / 0 / 1185 | 565 / 12 / 1023 | 539.2 | 1.55 | 42.8 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 43.8 | 45.4 | 10.8 | 0.0 | 49.1 % | -0.38 |
| Titan vs Titan | 500 | 42.4 | 40.2 | 17.4 | 0.0 | 51.3 % | 0.54 |
| Tempest vs Tempest | 500 | 47.8 | 47.2 | 5.0 | 0.0 | 50.3 % | 0.14 |
| Phantom vs Phantom | 500 | 41.4 | 40.0 | 18.6 | 0.0 | 50.9 % | 0.35 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 43.8 | 45.4 | 10.8 (48) | 0.0 | 41.3 | 40.7 | 28.3–57.4 | 0.0 / 2.0 / 4.6 | 3.6 | 4.8 | 80.8 | 62.4 | 250.9 HP (39.8%) | 4.6% | 370.3 / 371.8 | 0.79 | 4.9 | 7.7 | 161.0 | 0 |
| Inferno vs Titan | 28.6 | 70.8 | 0.6 (3) | 0.0 | 39.8 | 41.3 | 33.2–44.1 | 0.0 / 0.0 / 0.0 | 27.2 | 0.0 | 72.2 | 25.6 | 105.1 HP (15.1%) | 2.7% | 653.5 / 456.9 | 1.68 | 4.9 | 16.2 | 129.8 | 0 |
| Inferno vs Tempest | 94.8 | 5.2 | 0.0 (0) | 0.0 | 16.5 | 17.8 | 0.9–28.6 | 19.6 / 20.6 / 23.4 | 74.2 | 20.6 | 5.2 | 0.0 | 401.4 HP (63.4%) | 26.3% | 565.4 / 210.9 | 1.45 | 5.0 | 14.4 | 121.4 | 0 |
| Inferno vs Phantom | 42.8 | 56.8 | 0.4 (0) | 0.0 | 35.9 | 37.9 | 26.7–42.2 | 0.8 / 0.8 / 0.8 | 41.8 | 0.8 | 57.0 | 12.6 | 112.2 HP (16.9%) | 4.3% | 645.2 / 444.0 | 1.49 | 5.0 | 14.6 | 132.8 | 0 |
| Titan vs Inferno | 63.2 | 36.0 | 0.8 (4) | 0.0 | 38.9 | 40.2 | 32.1–44.2 | 0.0 / 0.0 / 0.0 | 34.0 | 0.0 | 65.2 | 21.2 | 106.6 HP (15.5%) | 3.0% | 460.1 / 663.1 | 1.69 | 4.9 | 16.4 | 127.7 | 0 |
| Titan vs Titan | 42.4 | 40.2 | 17.4 (85) | 0.0 | 45.6 | 46.2 | 42.5–47.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 82.6 | 81.6 | 451.6 HP (62.7%) | 0.6% | 256.2 / 256.4 | 1.93 | 5.0 | 5.7 | 39.1 | 0 |
| Titan vs Tempest | 21.8 | 78.2 | 0.0 (0) | 0.0 | 42.3 | 45.0 | 30.6–47.8 | 0.0 / 0.0 / 0.0 | 21.8 | 0.0 | 78.2 | 0.0 | 166.1 HP (23.8%) | 29.8% | 607.2 / 301.7 | 5.32 | 4.9 | 22.6 | 41.1 | 0 |
| Titan vs Phantom | 41.8 | 46.0 | 12.2 (45) | 0.0 | 41.9 | 43.0 | 36.1–45.9 | 0.0 / 0.0 / 0.0 | 22.0 | 0.0 | 65.8 | 63.6 | 95.4 HP (13.5%) | 2.2% | 610.7 / 623.0 | 3.48 | 4.8 | 26.2 | 61.6 | 0 |
| Tempest vs Inferno | 7.2 | 92.4 | 0.4 (0) | 0.0 | 17.0 | 17.4 | 1.0–31.0 | 17.0 / 18.4 / 21.6 | 74.0 | 18.4 | 7.2 | 0.0 | 391.9 HP (61.8%) | 25.6% | 213.1 / 579.2 | 1.48 | 5.0 | 14.7 | 123.1 | 0 |
| Tempest vs Titan | 73.6 | 26.4 | 0.0 (0) | 0.0 | 41.8 | 44.5 | 30.3–47.8 | 0.0 / 0.0 / 0.0 | 26.4 | 0.0 | 73.6 | 0.0 | 180.3 HP (25.8%) | 28.9% | 303.3 / 610.7 | 5.37 | 5.0 | 23.2 | 39.6 | 0 |
| Tempest vs Tempest | 47.8 | 47.2 | 5.0 (24) | 0.0 | 69.2 | 69.3 | 64.9–73.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 95.0 | 87.6 | 690.0 HP (100.0%) | 0.8% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 55.2 | 44.6 | 0.2 (0) | 0.0 | 45.6 | 48.4 | 35.8–52.0 | 0.0 / 0.0 / 0.0 | 44.6 | 0.0 | 55.2 | 0.0 | 191.0 HP (27.7%) | 21.9% | 335.7 / 648.9 | 4.74 | 4.9 | 38.9 | 51.3 | 0 |
| Phantom vs Inferno | 58.4 | 41.2 | 0.4 (0) | 0.0 | 35.9 | 38.4 | 27.2–42.0 | 1.6 / 1.6 / 1.6 | 39.4 | 1.6 | 58.6 | 9.0 | 121.0 HP (18.2%) | 5.0% | 432.9 / 635.1 | 1.46 | 5.0 | 14.3 | 137.5 | 0 |
| Phantom vs Titan | 45.6 | 43.4 | 11.0 (38) | 0.0 | 41.9 | 42.8 | 36.7–45.8 | 0.0 / 0.0 / 0.0 | 21.0 | 0.0 | 68.0 | 64.8 | 94.4 HP (13.4%) | 2.0% | 624.7 / 613.3 | 3.52 | 4.9 | 26.4 | 62.0 | 0 |
| Phantom vs Tempest | 44.2 | 55.6 | 0.2 (0) | 0.0 | 45.4 | 48.4 | 34.7–51.8 | 0.0 / 0.0 / 0.0 | 44.2 | 0.0 | 55.6 | 0.0 | 192.2 HP (27.9%) | 22.2% | 647.3 / 334.5 | 4.77 | 5.0 | 38.7 | 53.5 | 0 |
| Phantom vs Phantom | 41.4 | 40.0 | 18.6 (90) | 0.0 | 53.1 | 54.0 | 48.0–56.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 81.4 | 80.4 | 329.9 HP (47.8%) | 0.5% | 353.9 / 354.4 | 2.20 | 4.9 | 14.6 | 57.2 | 0 |
