Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=good opponent=good ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 41.0% | 30.2% | 94.2% | 41.4% |
| **Titan** | 68.8% | 38.6% | 22.6% | 37.2% |
| **Tempest** | 7.0% | 74.2% | 49.0% | 58.4% |
| **Phantom** | 60.6% | 50.6% | 43.2% | 34.6% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 41.4% | 30.6% | 93.6% | 40.1% |
| **Titan** | 69.1% | 37.4% | 24.2% | 36.5% |
| **Tempest** | 6.4% | 75.8% | 47.8% | 57.4% |
| **Phantom** | 59.1% | 50.3% | 42.3% | 33.4% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 29.8 % | 39.5 % |
| Knockout finishes | 2.4 % | 2.8 % |
| Spin finishes | 61.0 % | 55.3 % |
| Draws (near-simultaneous) | 6.8 % (497) | 2.4 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 40.7 / 42.2 s | 36.6 / 40.2 s |
| P10 / P25 / P75 / P90 | 22.6 / 35.0 / 47.1 / 54.9 s | 18.5 / 32.0 / 44.0 / 47.7 s |
| Ended < 2 s / < 5 s / < 10 s | 2.1 / 2.3 / 2.8 % | 2.8 / 2.8 / 3.4 % |
| Avg damage dealt per top | 438.9 | |
| Avg collisions | 18.2 | |
| Crits per battle / % of damaging hits | 2.68 / 4.8 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 52.8 | 54.8 | 44.4 | 2.8 | 1476 / 179 / 193 | 8 / 11 / 1536 | 588.1 | 0.75 | 32.5 |
| Titan | 3500 | 42.6 | 43.3 | 49.9 | 7.5 | 409 / 0 / 1082 | 368 / 0 / 1380 | 510.5 | 1.69 | 41.3 |
| Tempest | 3500 | 46.9 | 46.5 | 52.4 | 0.7 | 0 / 0 / 1641 | 1437 / 164 / 233 | 243.1 | 1.72 | 39.4 |
| Phantom | 3500 | 48.3 | 50.6 | 42.9 | 8.8 | 489 / 0 / 1201 | 563 / 5 / 933 | 537.7 | 1.61 | 42.6 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 41.0 | 41.8 | 17.2 | 0.0 | 49.5 % | -0.20 |
| Titan vs Titan | 500 | 38.6 | 36.2 | 25.2 | 0.0 | 51.6 % | 0.62 |
| Tempest vs Tempest | 500 | 49.0 | 46.6 | 4.4 | 0.0 | 51.3 % | 0.55 |
| Phantom vs Phantom | 500 | 34.6 | 32.2 | 33.2 | 0.0 | 51.8 % | 0.66 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 41.0 | 41.8 | 17.2 (85) | 0.0 | 44.0 | 45.7 | 29.9–57.0 | 0.0 / 3.2 / 3.8 | 2.8 | 4.2 | 75.8 | 62.8 | 273.3 HP (43.4%) | 4.0% | 339.0 / 340.7 | 0.79 | 5.1 | 7.2 | 157.4 | 0 |
| Inferno vs Titan | 30.2 | 69.4 | 0.4 (2) | 0.0 | 39.1 | 40.6 | 31.8–43.8 | 0.0 / 0.0 / 0.0 | 29.6 | 0.0 | 70.0 | 25.2 | 106.9 HP (15.4%) | 2.8% | 655.0 / 455.9 | 1.72 | 5.1 | 16.2 | 124.7 | 0 |
| Inferno vs Tempest | 94.2 | 5.8 | 0.0 (0) | 0.0 | 16.7 | 16.6 | 1.1–29.7 | 15.8 / 16.0 / 18.6 | 78.2 | 16.0 | 5.8 | 0.0 | 389.4 HP (61.5%) | 23.6% | 592.4 / 220.2 | 1.58 | 5.1 | 15.1 | 123.9 | 0 |
| Inferno vs Phantom | 41.4 | 57.6 | 1.0 (0) | 0.0 | 35.5 | 37.7 | 27.1–41.6 | 0.4 / 0.4 / 0.4 | 41.0 | 0.4 | 57.6 | 10.0 | 110.2 HP (16.6%) | 3.9% | 647.0 / 443.7 | 1.54 | 5.2 | 14.5 | 134.0 | 0 |
| Titan vs Inferno | 68.8 | 31.0 | 0.2 (1) | 0.0 | 39.0 | 40.8 | 32.0–43.7 | 0.0 / 0.0 / 0.2 | 30.8 | 0.0 | 69.0 | 23.4 | 106.5 HP (15.4%) | 2.8% | 455.8 / 655.1 | 1.76 | 5.2 | 16.2 | 126.8 | 0 |
| Titan vs Titan | 38.6 | 36.2 | 25.2 (124) | 0.0 | 46.1 | 46.1 | 44.7–47.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 74.8 | 74.8 | 498.8 HP (69.3%) | 0.4% | 216.7 / 217.8 | 1.76 | 5.2 | 3.5 | 35.3 | 0 |
| Titan vs Tempest | 22.6 | 77.4 | 0.0 (0) | 0.0 | 41.6 | 44.4 | 29.8–47.0 | 0.0 / 0.0 / 0.0 | 22.6 | 0.0 | 77.4 | 0.0 | 176.0 HP (25.3%) | 29.5% | 601.0 / 297.4 | 5.48 | 5.1 | 22.1 | 41.8 | 0 |
| Titan vs Phantom | 37.2 | 50.0 | 12.8 (48) | 0.0 | 41.2 | 41.9 | 36.4–44.8 | 0.0 / 0.0 / 0.0 | 22.6 | 0.0 | 64.6 | 64.6 | 82.6 HP (11.7%) | 2.0% | 620.5 / 630.7 | 3.74 | 5.1 | 27.0 | 61.9 | 0 |
| Tempest vs Inferno | 7.0 | 93.0 | 0.0 (0) | 0.0 | 17.3 | 17.2 | 1.0–31.1 | 16.4 / 16.8 / 20.8 | 76.2 | 16.8 | 7.0 | 0.0 | 388.6 HP (61.3%) | 24.3% | 217.1 / 586.7 | 1.60 | 5.2 | 15.0 | 123.2 | 0 |
| Tempest vs Titan | 74.2 | 25.8 | 0.0 (0) | 0.0 | 41.2 | 44.3 | 29.7–47.2 | 0.0 / 0.0 / 0.2 | 25.8 | 0.0 | 74.2 | 0.0 | 184.1 HP (26.4%) | 29.0% | 300.8 / 604.8 | 5.50 | 5.1 | 22.6 | 40.8 | 0 |
| Tempest vs Tempest | 49.0 | 46.6 | 4.4 (22) | 0.0 | 68.6 | 68.5 | 65.8–71.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 95.6 | 95.6 | 690.0 HP (100.0%) | 0.5% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 58.4 | 41.4 | 0.2 (0) | 0.0 | 45.3 | 48.3 | 34.6–51.7 | 0.0 / 0.0 / 0.0 | 41.4 | 0.0 | 58.4 | 0.0 | 185.1 HP (26.8%) | 23.0% | 333.6 / 643.9 | 4.92 | 5.1 | 38.3 | 53.9 | 0 |
| Phantom vs Inferno | 60.6 | 38.8 | 0.6 (0) | 0.0 | 36.0 | 38.1 | 27.1–42.0 | 0.6 / 0.6 / 0.6 | 38.2 | 0.6 | 60.6 | 10.0 | 111.8 HP (16.8%) | 3.9% | 438.6 / 641.7 | 1.53 | 5.2 | 14.4 | 135.6 | 0 |
| Phantom vs Titan | 50.6 | 35.8 | 13.6 (50) | 0.0 | 41.2 | 42.1 | 36.4–44.9 | 0.0 / 0.0 / 0.0 | 24.0 | 0.0 | 62.4 | 62.4 | 82.1 HP (11.7%) | 2.1% | 631.6 / 618.7 | 3.78 | 5.2 | 26.7 | 61.5 | 0 |
| Phantom vs Tempest | 43.2 | 56.4 | 0.4 (0) | 0.0 | 45.1 | 48.2 | 34.6–51.5 | 0.0 / 0.0 / 0.0 | 43.2 | 0.0 | 56.4 | 0.0 | 192.0 HP (27.8%) | 22.4% | 644.6 / 332.2 | 4.92 | 5.1 | 38.4 | 50.4 | 0 |
| Phantom vs Phantom | 34.6 | 32.2 | 33.2 (165) | 0.0 | 53.8 | 54.1 | 51.0–56.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 66.8 | 66.8 | 351.1 HP (50.9%) | 0.3% | 330.5 / 330.7 | 2.22 | 5.1 | 13.8 | 54.3 | 0 |
