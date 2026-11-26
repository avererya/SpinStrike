Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.2 (legacy v0.2 configuration) · critical hits off · launch player=auto opponent=auto ('auto' = seeded AI distribution) · draw window 0 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 51.0% | 0.0% | 76.8% | 0.2% |
| **Titan** | 100.0% | 50.0% | 0.0% | 100.0% |
| **Tempest** | 22.0% | 100.0% | 50.0% | 41.2% |
| **Phantom** | 99.8% | 0.0% | 58.4% | 50.0% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 49.9% | 0.0% | 77.4% | 0.1% |
| **Titan** | 100.0% | 49.8% | 0.0% | 100.0% |
| **Tempest** | 22.6% | 100.0% | 50.0% | 41.3% |
| **Phantom** | 99.8% | 0.0% | 58.6% | 49.7% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 16.1 % | 21.4 % |
| Knockout finishes | 1.0 % | 1.3 % |
| Spin finishes | 82.7 % | 77.3 % |
| Draws (near-simultaneous) | 0.1 % (0) | 0.0 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 38.3 / 42.0 s | 34.1 / 30.1 s |
| P10 / P25 / P75 / P90 | 18.7 / 26.0 / 49.5 / 53.4 s | 15.7 / 24.8 / 47.5 / 49.9 s |
| Ended < 2 s / < 5 s / < 10 s | 0.8 / 1.0 / 2.8 % | 1.0 / 1.3 / 3.7 % |
| Avg damage dealt per top | 270.6 | |
| Avg collisions | 20.3 | |
| Crits per battle / % of damaging hits | 0.00 / 0.0 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 29.4 | 25.8 | 70.5 | 0.1 | 701 / 82 / 247 | 3 / 1 / 2464 | 384.2 | 0.00 | 22.9 |
| Titan | 3500 | 64.3 | 66.7 | 35.7 | 0.1 | 0 / 0 / 2250 | 0 / 0 / 1248 | 221.8 | 0.00 | 42.2 |
| Tempest | 3500 | 54.0 | 54.6 | 46.0 | 0.0 | 0 / 0 / 1889 | 1283 / 77 / 250 | 159.3 | 0.00 | 40.4 |
| Phantom | 3500 | 52.4 | 52.8 | 47.5 | 0.1 | 586 / 0 / 1248 | 0 / 1 / 1660 | 390.9 | 0.00 | 40.5 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 51.0 | 48.8 | 0.2 | 0.0 | 51.1 % | 0.49 |
| Titan vs Titan | 500 | 50.0 | 49.6 | 0.4 | 0.0 | 50.2 % | 0.09 |
| Tempest vs Tempest | 500 | 50.0 | 50.0 | 0.0 | 0.0 | 50.0 % | 0.00 |
| Phantom vs Phantom | 500 | 50.0 | 49.4 | 0.6 | 0.0 | 50.3 % | 0.13 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 51.0 | 48.8 | 0.2 (0) | 0.0 | 27.6 | 29.0 | 19.0–34.6 | 0.0 / 1.0 / 1.0 | 1.4 | 1.0 | 97.4 | 86.8 | 396.1 HP (66.0%) | 1.5% | 206.6 / 206.6 | 0.00 | 0.0 | 6.0 | 68.7 | 0 |
| Inferno vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 27.1 | 27.5 | 24.2–29.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 566.2 HP (62.9%) | 30.7% | 333.8 / 126.7 | 0.00 | 0.0 | 10.7 | 52.6 | 0 |
| Inferno vs Tempest | 76.8 | 23.2 | 0.0 (0) | 0.0 | 14.5 | 14.4 | 7.6–22.9 | 6.2 / 7.4 / 21.2 | 69.4 | 7.4 | 23.2 | 0.0 | 365.8 HP (61.0%) | 24.5% | 552.6 / 140.4 | 0.00 | 0.0 | 13.9 | 65.0 | 0 |
| Inferno vs Phantom | 0.2 | 99.8 | 0.0 (0) | 0.0 | 25.1 | 25.6 | 21.1–28.1 | 0.2 / 0.2 / 0.2 | 0.0 | 0.2 | 99.8 | 0.0 | 296.4 HP (45.6%) | 21.4% | 353.6 / 251.6 | 0.00 | 0.0 | 10.3 | 58.6 | 0 |
| Titan vs Inferno | 100.0 | 0.0 | 0.0 (0) | 0.0 | 27.0 | 27.4 | 24.7–29.3 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 565.0 HP (62.8%) | 30.9% | 127.2 / 335.0 | 0.00 | 0.0 | 10.9 | 52.7 | 0 |
| Titan vs Titan | 50.0 | 49.6 | 0.4 (0) | 0.0 | 50.9 | 51.2 | 47.1–53.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.6 | 99.4 | 787.9 HP (87.5%) | 0.4% | 113.0 / 112.9 | 0.00 | 0.0 | 10.7 | 6.9 | 0 |
| Titan vs Tempest | 0.0 | 100.0 | 0.0 (0) | 0.0 | 47.5 | 47.6 | 44.5–50.2 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 221.2 HP (36.9%) | 26.7% | 378.8 / 230.5 | 0.00 | 0.0 | 45.1 | 10.6 | 0 |
| Titan vs Phantom | 100.0 | 0.0 | 0.0 (0) | 0.0 | 47.8 | 48.0 | 45.3–50.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 482.7 HP (53.6%) | 5.8% | 214.3 / 417.3 | 0.00 | 0.0 | 29.3 | 23.2 | 0 |
| Tempest vs Inferno | 22.0 | 78.0 | 0.0 (0) | 0.0 | 14.4 | 14.1 | 7.4–22.8 | 5.6 / 8.0 / 22.6 | 70.0 | 8.0 | 22.0 | 0.0 | 370.9 HP (61.8%) | 24.3% | 139.8 / 551.2 | 0.00 | 0.0 | 13.8 | 64.6 | 0 |
| Tempest vs Titan | 100.0 | 0.0 | 0.0 (0) | 0.0 | 47.3 | 47.3 | 44.3–50.2 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 221.5 HP (36.9%) | 26.7% | 230.3 / 378.5 | 0.00 | 0.0 | 45.2 | 10.7 | 0 |
| Tempest vs Tempest | 50.0 | 50.0 | 0.0 (0) | 0.0 | 72.9 | 72.8 | 67.4–78.5 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 89.8 | 600.0 HP (100.0%) | 0.9% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 41.2 | 58.8 | 0.0 (0) | 0.0 | 43.1 | 44.0 | 32.3–52.3 | 0.0 / 0.0 / 0.0 | 58.8 | 0.0 | 41.2 | 0.0 | 294.9 HP (46.9%) | 23.0% | 186.5 / 573.3 | 0.00 | 0.0 | 36.8 | 28.3 | 0 |
| Phantom vs Inferno | 99.8 | 0.0 | 0.2 (0) | 0.0 | 24.9 | 25.4 | 21.3–27.9 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.8 | 0.0 | 293.8 HP (45.2%) | 21.3% | 253.7 / 356.8 | 0.00 | 0.0 | 10.3 | 59.0 | 0 |
| Phantom vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 47.8 | 48.2 | 45.1–50.3 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 481.9 HP (53.5%) | 5.7% | 418.1 / 214.3 | 0.00 | 0.0 | 29.2 | 23.2 | 0 |
| Phantom vs Tempest | 58.4 | 41.4 | 0.2 (0) | 0.0 | 43.2 | 43.8 | 32.7–52.3 | 0.0 / 0.0 / 0.0 | 58.4 | 0.0 | 41.4 | 0.0 | 289.9 HP (46.1%) | 22.8% | 577.0 / 187.7 | 0.00 | 0.0 | 36.8 | 28.1 | 0 |
| Phantom vs Phantom | 50.0 | 49.4 | 0.6 (0) | 0.0 | 51.8 | 52.6 | 47.5–55.4 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.4 | 99.0 | 407.0 HP (62.6%) | 0.4% | 245.6 / 245.3 | 0.00 | 0.0 | 16.1 | 22.8 | 0 |
