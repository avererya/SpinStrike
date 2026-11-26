Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.3 · critical hits on · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0.25 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 43.8% | 33.8% | 95.2% | 42.2% |
| **Titan** | 68.4% | 44.4% | 24.2% | 42.8% |
| **Tempest** | 5.4% | 71.6% | 49.0% | 57.6% |
| **Phantom** | 55.0% | 47.0% | 42.8% | 42.4% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 43.0% | 32.5% | 94.9% | 43.2% |
| **Titan** | 67.0% | 42.8% | 26.2% | 42.0% |
| **Tempest** | 5.1% | 73.7% | 48.4% | 57.3% |
| **Phantom** | 55.9% | 46.1% | 42.3% | 40.6% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 30.3 % | 39.9 % |
| Knockout finishes | 2.9 % | 3.2 % |
| Spin finishes | 62.0 % | 54.6 % |
| Draws (near-simultaneous) | 4.9 % (338) | 2.3 % |
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
| Inferno | 3500 | 55.0 | 56.9 | 42.6 | 2.4 | 1513 / 215 / 197 | 13 / 18 / 1460 | 588.9 | 0.75 | 32.0 |
| Titan | 3500 | 45.0 | 45.1 | 49.4 | 5.6 | 409 / 0 / 1165 | 373 / 0 / 1356 | 518.6 | 1.71 | 41.7 |
| Tempest | 3500 | 45.9 | 45.4 | 53.5 | 0.6 | 0 / 0 / 1606 | 1446 / 188 / 239 | 242.2 | 1.71 | 39.7 |
| Phantom | 3500 | 47.3 | 48.1 | 46.3 | 6.5 | 486 / 0 / 1169 | 573 / 6 / 1040 | 541.7 | 1.61 | 42.9 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 43.8 | 42.2 | 14.0 | 0.0 | 50.9 % | 0.39 |
| Titan vs Titan | 500 | 44.4 | 41.2 | 14.4 | 0.0 | 51.9 % | 0.77 |
| Tempest vs Tempest | 500 | 49.0 | 47.8 | 3.2 | 0.0 | 50.6 % | 0.27 |
| Phantom vs Phantom | 500 | 42.4 | 38.8 | 18.8 | 0.0 | 52.2 % | 0.89 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 43.8 | 42.2 | 14.0 (63) | 0.0 | 40.6 | 41.7 | 23.1–57.6 | 0.0 / 3.6 / 6.4 | 5.8 | 7.8 | 72.4 | 54.6 | 257.9 HP (40.9%) | 6.8% | 360.7 / 361.5 | 0.83 | 5.3 | 7.5 | 165.0 | 0 |
| Inferno vs Titan | 33.8 | 65.6 | 0.6 (2) | 0.0 | 38.9 | 40.7 | 31.0–44.1 | 0.0 / 0.0 / 0.0 | 32.0 | 0.0 | 67.4 | 24.4 | 103.5 HP (15.0%) | 3.0% | 661.9 / 461.6 | 1.77 | 5.2 | 16.3 | 127.6 | 0 |
| Inferno vs Tempest | 95.2 | 4.8 | 0.0 (0) | 0.0 | 16.6 | 17.3 | 1.0–29.0 | 18.4 / 19.2 / 21.8 | 76.0 | 19.2 | 4.8 | 0.0 | 400.1 HP (63.2%) | 25.4% | 573.4 / 213.3 | 1.55 | 5.2 | 14.5 | 123.9 | 0 |
| Inferno vs Phantom | 42.2 | 56.8 | 1.0 (0) | 0.0 | 35.9 | 38.3 | 27.1–41.9 | 0.6 / 0.6 / 0.6 | 41.6 | 0.6 | 56.8 | 13.0 | 110.1 HP (16.6%) | 4.1% | 648.1 / 444.9 | 1.55 | 5.2 | 14.6 | 135.9 | 0 |
| Titan vs Inferno | 68.4 | 31.2 | 0.4 (2) | 0.0 | 39.5 | 41.1 | 32.4–44.1 | 0.0 / 0.0 / 0.0 | 30.0 | 0.0 | 69.6 | 21.2 | 107.3 HP (15.5%) | 2.9% | 456.0 / 655.9 | 1.76 | 5.2 | 16.2 | 127.6 | 0 |
| Titan vs Titan | 44.4 | 41.2 | 14.4 (71) | 0.0 | 45.6 | 46.0 | 42.5–48.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 85.6 | 85.2 | 441.8 HP (61.4%) | 0.6% | 269.3 / 269.5 | 2.04 | 5.1 | 5.8 | 37.9 | 0 |
| Titan vs Tempest | 24.2 | 75.8 | 0.0 (0) | 0.0 | 42.1 | 44.8 | 30.2–47.9 | 0.0 / 0.0 / 0.4 | 24.2 | 0.0 | 75.8 | 0.0 | 176.0 HP (25.2%) | 29.4% | 607.1 / 300.4 | 5.48 | 5.1 | 22.5 | 42.8 | 0 |
| Titan vs Phantom | 42.8 | 45.2 | 12.0 (47) | 0.0 | 42.0 | 43.1 | 36.3–46.1 | 0.0 / 0.0 / 0.0 | 22.4 | 0.0 | 65.6 | 64.0 | 96.4 HP (13.7%) | 2.2% | 611.5 / 622.0 | 3.70 | 5.1 | 25.8 | 61.2 | 0 |
| Tempest vs Inferno | 5.4 | 94.6 | 0.0 (0) | 0.0 | 16.7 | 17.0 | 1.0–29.8 | 17.4 / 18.4 / 21.8 | 76.2 | 18.4 | 5.4 | 0.0 | 396.6 HP (62.6%) | 25.3% | 214.3 / 578.0 | 1.54 | 5.1 | 14.7 | 121.7 | 0 |
| Tempest vs Titan | 71.6 | 28.2 | 0.2 (0) | 0.0 | 41.7 | 44.9 | 30.3–48.2 | 0.0 / 0.0 / 0.2 | 28.2 | 0.0 | 71.6 | 0.0 | 189.2 HP (27.1%) | 28.8% | 303.1 / 608.7 | 5.53 | 5.1 | 22.7 | 41.3 | 0 |
| Tempest vs Tempest | 49.0 | 47.8 | 3.2 (16) | 0.0 | 69.1 | 69.2 | 64.7–73.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 96.8 | 91.8 | 690.0 HP (100.0%) | 0.8% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 57.6 | 41.8 | 0.6 (0) | 0.0 | 45.9 | 48.6 | 34.8–52.4 | 0.0 / 0.0 / 0.0 | 41.8 | 0.0 | 57.6 | 0.0 | 190.0 HP (27.5%) | 23.0% | 332.6 / 642.0 | 4.88 | 5.1 | 38.1 | 54.6 | 0 |
| Phantom vs Inferno | 55.0 | 44.2 | 0.8 (0) | 0.0 | 35.9 | 37.9 | 26.7–42.2 | 0.6 / 0.6 / 0.6 | 43.6 | 0.6 | 55.0 | 9.4 | 118.0 HP (17.8%) | 4.2% | 441.6 / 644.3 | 1.53 | 5.1 | 14.4 | 136.1 | 0 |
| Phantom vs Titan | 47.0 | 41.2 | 11.8 (44) | 0.0 | 42.0 | 42.6 | 37.1–45.9 | 0.0 / 0.0 / 0.0 | 19.6 | 0.0 | 68.6 | 65.2 | 88.2 HP (12.5%) | 2.0% | 628.8 / 615.6 | 3.71 | 5.1 | 26.7 | 61.5 | 0 |
| Phantom vs Tempest | 42.8 | 57.0 | 0.2 (0) | 0.0 | 45.7 | 48.4 | 35.2–52.4 | 0.0 / 0.0 / 0.0 | 42.8 | 0.0 | 57.0 | 0.0 | 191.4 HP (27.7%) | 22.7% | 644.1 / 331.7 | 4.87 | 5.1 | 38.1 | 50.1 | 0 |
| Phantom vs Phantom | 42.4 | 38.8 | 18.8 (93) | 0.0 | 53.0 | 53.7 | 48.4–56.5 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 81.2 | 80.8 | 316.0 HP (45.8%) | 0.5% | 368.3 / 368.0 | 2.36 | 5.1 | 15.3 | 56.1 | 0 |
