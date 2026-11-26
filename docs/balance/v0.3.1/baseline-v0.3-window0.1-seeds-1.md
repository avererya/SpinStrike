Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0.1 s.
Overrides: results.drawWindow=0.1
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 47.6% | 33.8% | 95.2% | 42.2% |
| **Titan** | 68.4% | 47.4% | 24.2% | 46.4% |
| **Tempest** | 5.4% | 71.6% | 49.4% | 57.6% |
| **Phantom** | 55.0% | 49.6% | 42.8% | 48.0% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 46.7% | 32.6% | 94.9% | 43.2% |
| **Titan** | 67.0% | 47.2% | 26.2% | 45.1% |
| **Tempest** | 5.1% | 73.7% | 49.3% | 57.3% |
| **Phantom** | 55.9% | 49.0% | 42.3% | 46.1% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 30.3 % | 39.9 % |
| Knockout finishes | 2.9 % | 3.2 % |
| Spin finishes | 64.5 % | 55.6 % |
| Draws (near-simultaneous) | 2.3 % (132) | 1.3 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 40.7 / 42.5 s | 36.9 / 40.5 s |
| P10 / P25 / P75 / P90 | 21.8 / 34.8 / 47.5 / 54.9 s | 18.4 / 32.1 / 44.7 / 48.3 s |
| Ended < 2 s / < 5 s / < 10 s | 2.3 / 2.6 / 3.2 % | 3.1 / 3.2 / 3.8 % |
| Avg damage dealt per top | 444.9 | |
| Avg collisions | 18.3 | |
| Crits per battle / % of damaging hits | 2.69 / 4.8 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 55.6 | 56.9 | 43.1 | 1.3 | 1513 / 215 / 217 | 13 / 18 / 1478 | 588.9 | 0.75 | 32.0 |
| Titan | 3500 | 46.3 | 46.1 | 51.1 | 2.6 | 409 / 0 / 1211 | 373 / 0 / 1415 | 518.6 | 1.71 | 41.7 |
| Tempest | 3500 | 45.9 | 45.4 | 53.7 | 0.3 | 0 / 0 / 1608 | 1446 / 188 / 246 | 242.2 | 1.71 | 39.7 |
| Phantom | 3500 | 48.9 | 49.1 | 47.9 | 3.2 | 486 / 0 / 1226 | 573 / 6 / 1098 | 541.7 | 1.61 | 42.9 |

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
| Inferno vs Tempest | 95.2 | 4.8 | 0.0 (0) | 0.0 | 16.6 | 17.3 | 1.0–29.0 | 18.4 / 19.2 / 21.8 | 76.0 | 19.2 | 4.8 | 0.0 | 400.1 HP (63.2%) | 25.4% | 573.4 / 213.3 | 1.55 | 5.2 | 14.5 | 123.9 | 0 |
| Inferno vs Phantom | 42.2 | 56.8 | 1.0 (0) | 0.0 | 35.9 | 38.3 | 27.1–41.9 | 0.6 / 0.6 / 0.6 | 41.6 | 0.6 | 56.8 | 13.0 | 110.1 HP (16.6%) | 4.1% | 648.1 / 444.9 | 1.55 | 5.2 | 14.6 | 135.9 | 0 |
| Titan vs Inferno | 68.4 | 31.4 | 0.2 (1) | 0.0 | 39.5 | 41.1 | 32.4–44.1 | 0.0 / 0.0 / 0.0 | 30.0 | 0.0 | 69.8 | 21.4 | 107.4 HP (15.5%) | 2.9% | 456.0 / 655.9 | 1.76 | 5.2 | 16.2 | 127.6 | 0 |
| Titan vs Titan | 47.4 | 47.0 | 5.6 (27) | 0.0 | 45.6 | 46.0 | 42.5–48.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 94.4 | 94.0 | 449.4 HP (62.4%) | 0.5% | 269.3 / 269.5 | 2.04 | 5.1 | 5.8 | 37.9 | 0 |
| Titan vs Tempest | 24.2 | 75.8 | 0.0 (0) | 0.0 | 42.1 | 44.8 | 30.2–47.9 | 0.0 / 0.0 / 0.4 | 24.2 | 0.0 | 75.8 | 0.0 | 176.0 HP (25.2%) | 29.4% | 607.1 / 300.4 | 5.48 | 5.1 | 22.5 | 42.8 | 0 |
| Titan vs Phantom | 46.4 | 48.4 | 5.2 (13) | 0.0 | 42.0 | 43.1 | 36.3–46.1 | 0.0 / 0.0 / 0.0 | 22.4 | 0.0 | 72.4 | 70.8 | 96.5 HP (13.7%) | 2.0% | 611.5 / 622.0 | 3.70 | 5.1 | 25.8 | 61.2 | 0 |
| Tempest vs Inferno | 5.4 | 94.6 | 0.0 (0) | 0.0 | 16.7 | 17.0 | 1.0–29.8 | 17.4 / 18.4 / 21.8 | 76.2 | 18.4 | 5.4 | 0.0 | 396.6 HP (62.6%) | 25.3% | 214.3 / 578.0 | 1.54 | 5.1 | 14.7 | 121.7 | 0 |
| Tempest vs Titan | 71.6 | 28.2 | 0.2 (0) | 0.0 | 41.7 | 44.9 | 30.3–48.2 | 0.0 / 0.0 / 0.2 | 28.2 | 0.0 | 71.6 | 0.0 | 189.2 HP (27.1%) | 28.8% | 303.1 / 608.7 | 5.53 | 5.1 | 22.7 | 41.3 | 0 |
| Tempest vs Tempest | 49.4 | 49.2 | 1.4 (7) | 0.0 | 69.1 | 69.2 | 64.7–73.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 98.6 | 93.6 | 690.0 HP (100.0%) | 0.8% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 57.6 | 41.8 | 0.6 (0) | 0.0 | 45.9 | 48.6 | 34.8–52.4 | 0.0 / 0.0 / 0.0 | 41.8 | 0.0 | 57.6 | 0.0 | 190.0 HP (27.5%) | 23.0% | 332.6 / 642.0 | 4.88 | 5.1 | 38.1 | 54.6 | 0 |
| Phantom vs Inferno | 55.0 | 44.2 | 0.8 (0) | 0.0 | 35.9 | 37.9 | 26.7–42.2 | 0.6 / 0.6 / 0.6 | 43.6 | 0.6 | 55.0 | 9.4 | 118.0 HP (17.8%) | 4.2% | 441.6 / 644.3 | 1.53 | 5.1 | 14.4 | 136.1 | 0 |
| Phantom vs Titan | 49.6 | 43.8 | 6.6 (18) | 0.0 | 42.0 | 42.6 | 37.1–45.9 | 0.0 / 0.0 / 0.0 | 19.6 | 0.0 | 73.8 | 70.4 | 89.2 HP (12.7%) | 1.9% | 628.8 / 615.6 | 3.71 | 5.1 | 26.7 | 61.5 | 0 |
| Phantom vs Tempest | 42.8 | 57.0 | 0.2 (0) | 0.0 | 45.7 | 48.4 | 35.2–52.4 | 0.0 / 0.0 / 0.0 | 42.8 | 0.0 | 57.0 | 0.0 | 191.4 HP (27.7%) | 22.7% | 644.1 / 331.7 | 4.87 | 5.1 | 38.1 | 50.1 | 0 |
| Phantom vs Phantom | 48.0 | 44.2 | 7.8 (38) | 0.0 | 53.0 | 53.7 | 48.4–56.5 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 92.2 | 91.8 | 320.4 HP (46.4%) | 0.5% | 368.3 / 368.0 | 2.36 | 5.1 | 15.3 | 56.1 | 0 |
