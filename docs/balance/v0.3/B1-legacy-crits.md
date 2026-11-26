Seeds 1–500 per ordered matchup, 8000 battles, max duration 180 s, 0 failures (guard trips / non-finite values / exceptions).
Ruleset v0.2 (legacy v0.2 configuration) · critical hits on · launch player=poor opponent=poor ('auto' = seeded AI distribution) · draw window 0 s.
Overrides: none
Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.

### Matchup matrix (row = player slot)
| Row beats column (row = player slot) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 52.4% | 0.0% | 81.6% | 0.8% |
| **Titan** | 100.0% | 50.4% | 0.0% | 100.0% |
| **Tempest** | 19.6% | 100.0% | 51.0% | 29.2% |
| **Phantom** | 99.2% | 0.0% | 68.0% | 50.0% |

### Matchup matrix (slot-averaged)
| Row beats column (both slot orders) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 50.0% | 0.0% | 81.0% | 0.8% |
| **Titan** | 100.0% | 49.7% | 0.0% | 100.0% |
| **Tempest** | 19.0% | 100.0% | 50.0% | 30.5% |
| **Phantom** | 99.1% | 0.0% | 69.1% | 49.7% |

### Overall
| Metric | All battles | Non-mirror |
| --- | --- | --- |
| Battles | 8000 | 6000 |
| Burst finishes | 18.1 % | 24.0 % |
| Knockout finishes | 0.9 % | 1.1 % |
| Spin finishes | 80.9 % | 74.8 % |
| Draws (near-simultaneous) | 0.1 % (0) | 0.1 % |
| Timeouts | 0.0 % | 0.0 % |
| Mean / median duration | 37.1 / 38.1 s | 32.8 / 29.2 s |
| P10 / P25 / P75 / P90 | 17.9 / 25.7 / 48.1 / 52.2 s | 14.4 / 24.2 / 45.8 / 48.0 s |
| Ended < 2 s / < 5 s / < 10 s | 0.7 / 0.9 / 3.3 % | 1.0 / 1.2 / 4.4 % |
| Avg damage dealt per top | 268.5 | |
| Avg collisions | 19.2 | |
| Crits per battle / % of damaging hits | 2.68 / 4.8 % | |
| Failures (guard trips / non-finite / exceptions) | 0 | |

### Per-top aggregate
| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | 3500 | 30.9 | 27.3 | 69.1 | 0.0 | 753 / 70 / 257 | 1 / 1 / 2417 | 386.2 | 0.55 | 22.6 |
| Titan | 3500 | 64.3 | 66.7 | 35.6 | 0.1 | 0 / 0 / 2252 | 0 / 0 / 1245 | 219.0 | 1.86 | 41.0 |
| Tempest | 3500 | 50.0 | 49.8 | 49.9 | 0.1 | 0 / 0 / 1750 | 1433 / 68 / 245 | 159.4 | 1.85 | 38.3 |
| Phantom | 3500 | 55.2 | 56.1 | 44.6 | 0.2 | 691 / 0 / 1241 | 8 / 0 / 1552 | 394.4 | 1.48 | 39.2 |

### Mirror-match slot fairness
| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 500 | 52.4 | 47.6 | 0.0 | 0.0 | 52.4 % | 1.07 |
| Titan vs Titan | 500 | 50.4 | 49.0 | 0.6 | 0.0 | 50.7 % | 0.31 |
| Tempest vs Tempest | 500 | 51.0 | 49.0 | 0.0 | 0.0 | 51.0 % | 0.45 |
| Phantom vs Phantom | 500 | 50.0 | 49.4 | 0.6 | 0.0 | 50.3 % | 0.13 |

### Per-matchup detail (P1 = player slot = first name)
| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 52.4 | 47.6 | 0.0 (0) | 0.0 | 29.0 | 30.7 | 21.7–33.8 | 0.0 / 0.6 / 0.6 | 0.8 | 0.6 | 98.6 | 94.4 | 440.4 HP (73.4%) | 0.9% | 161.1 / 162.7 | 0.50 | 5.0 | 4.6 | 130.7 | 0 |
| Inferno vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 26.5 | 26.9 | 23.3–28.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 556.1 HP (61.8%) | 30.8% | 343.9 / 130.1 | 1.10 | 5.1 | 10.6 | 98.3 | 0 |
| Inferno vs Tempest | 81.6 | 18.4 | 0.0 (0) | 0.0 | 13.5 | 12.8 | 7.1–21.9 | 6.4 / 7.6 / 26.8 | 74.2 | 7.4 | 18.4 | 0.0 | 383.6 HP (63.9%) | 23.5% | 558.5 / 141.9 | 1.39 | 5.2 | 13.3 | 126.3 | 0 |
| Inferno vs Phantom | 0.8 | 99.0 | 0.2 (0) | 0.0 | 24.5 | 24.9 | 20.6–27.2 | 0.0 / 0.0 / 0.0 | 0.8 | 0.0 | 99.0 | 0.0 | 287.5 HP (44.3%) | 21.1% | 364.6 / 259.2 | 1.07 | 5.1 | 10.1 | 110.6 | 0 |
| Titan vs Inferno | 100.0 | 0.0 | 0.0 (0) | 0.0 | 26.4 | 26.9 | 23.5–28.6 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 553.9 HP (61.5%) | 30.9% | 130.5 / 346.1 | 1.12 | 5.1 | 10.7 | 100.2 | 0 |
| Titan vs Titan | 50.4 | 49.0 | 0.6 (0) | 0.0 | 50.2 | 50.3 | 48.4–52.0 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.4 | 99.4 | 809.9 HP (90.0%) | 0.2% | 90.7 / 90.7 | 2.36 | 5.3 | 6.6 | 12.0 | 0 |
| Titan vs Tempest | 0.0 | 100.0 | 0.0 (0) | 0.0 | 45.6 | 45.6 | 43.1–47.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 227.6 HP (37.9%) | 26.3% | 372.4 / 225.3 | 6.98 | 5.1 | 42.1 | 20.1 | 0 |
| Titan vs Phantom | 100.0 | 0.0 | 0.0 (0) | 0.0 | 46.5 | 46.8 | 43.9–48.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 475.6 HP (52.8%) | 5.8% | 217.4 / 424.4 | 3.73 | 5.1 | 28.3 | 43.6 | 0 |
| Tempest vs Inferno | 19.6 | 80.4 | 0.0 (0) | 0.0 | 13.8 | 13.4 | 7.4–22.0 | 5.2 / 6.4 / 25.8 | 74.2 | 6.2 | 19.6 | 0.0 | 378.4 HP (63.1%) | 23.4% | 142.4 / 561.7 | 1.42 | 5.2 | 13.4 | 128.6 | 0 |
| Tempest vs Titan | 100.0 | 0.0 | 0.0 (0) | 0.0 | 45.6 | 45.6 | 43.0–47.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 225.2 HP (37.5%) | 26.3% | 227.8 / 374.8 | 7.14 | 5.2 | 42.2 | 19.7 | 0 |
| Tempest vs Tempest | 51.0 | 49.0 | 0.0 (0) | 0.0 | 69.0 | 68.9 | 65.7–72.7 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 100.0 | 600.0 HP (100.0%) | 0.5% | 0.0 / 0.0 | 0.00 | 0.0 | 0.0 | 0.0 | 0 |
| Tempest vs Phantom | 29.2 | 70.2 | 0.6 (0) | 0.0 | 40.0 | 37.9 | 30.4–50.6 | 0.0 / 0.0 / 0.0 | 70.2 | 0.0 | 29.2 | 0.0 | 338.4 HP (53.3%) | 19.4% | 189.6 / 584.1 | 4.45 | 5.1 | 36.1 | 55.3 | 0 |
| Phantom vs Inferno | 99.2 | 0.8 | 0.0 (0) | 0.0 | 24.4 | 25.1 | 20.7–27.2 | 0.0 / 0.0 / 0.0 | 0.8 | 0.0 | 99.2 | 0.0 | 283.4 HP (43.6%) | 21.2% | 259.7 / 367.6 | 1.08 | 5.2 | 10.2 | 111.9 | 0 |
| Phantom vs Titan | 0.0 | 100.0 | 0.0 (0) | 0.0 | 46.5 | 46.8 | 43.8–48.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 474.1 HP (52.7%) | 5.7% | 425.9 / 217.5 | 3.74 | 5.1 | 28.4 | 42.9 | 0 |
| Phantom vs Tempest | 68.0 | 31.8 | 0.2 (0) | 0.0 | 40.5 | 38.7 | 31.1–50.5 | 0.0 / 0.0 / 0.0 | 68.0 | 0.0 | 31.8 | 0.0 | 327.8 HP (51.7%) | 20.0% | 584.0 / 188.7 | 4.44 | 5.1 | 36.0 | 51.8 | 0 |
| Phantom vs Phantom | 50.0 | 49.4 | 0.6 (0) | 0.0 | 51.7 | 52.1 | 49.0–53.8 | 0.0 / 0.0 / 0.0 | 0.0 | 0.0 | 99.4 | 99.4 | 427.4 HP (65.8%) | 0.2% | 223.7 / 223.7 | 2.29 | 5.2 | 14.0 | 41.7 | 0 |
