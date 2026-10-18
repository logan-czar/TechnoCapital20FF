# Consistency pass 2 (2026-10-18): stale rules and the CK3 check

This is a sweep of every design file against the current decisions (MEMORY, and 13-open-questions up to batch 115). It also checks the design against the goal of **CK3 with corporations instead of kingdoms**. Nothing has been edited yet.

- **Part A** lists mechanical fixes that only apply decisions Logan already made.
- **Part B** lists conflicts that need a ruling.
- **Part C** lists the CK3 gaps.

The questions for Parts B and C are batch 116 in the thread.

## Part A. Mechanical fixes (already decided, apply on approval)

| # | Stale rule | Where | Fix |
|---|---|---|---|
| A1 | **Influence used as a skill** (about 35 hits) | 1-core 1.6.3, 1.9.2, 1.12; 4-politics 4.9.4, 4.13, 4.15, 4.17.3, 4.19.1, 4.21.2, 4.24; 2-map 2.5.7, 2.8.6; 3-markets 3.3.4, 3.6.4, 3.12, 3.14.3; 5-ideology 5.8.4 | Change to Persuasion. In 3.9.7, "influence points" becomes PC. |
| A2 | **Intel as a number or level** (about 12 hits) | 2-map 2.21.6, 2.22; 4-politics 4.15.2, 4.19.2, 4.21.2, 4.22.2, 4.26.4; 12-setup 12.3 | Change to "learns one secret" (batch 63). Industry prices are seen through news, and accurate figures only through Pdoomberg. |
| A3 | **Hours budget leftovers** (about 15) | 2-map gala "6 hours"; 3-markets pitch, Desk Session, Investor Day, pitch book; 09 9.2; 11-addiction therapy; 13-events option costs | Make each one instant or ticked (batch 64). |
| A4 | **Numeric opinion** (about 12) | 3-markets 3.5.4, 3.11.4, 3.18.4; 1-core 1.4, 1.8.3, 1.11.2; 09 weekly row; 12-tech | Rewrite as Friend, Neutral and Rival tag reads and pushes. |
| A5 | **Old industry names** | Refining (about 8), chip packaging (3), "Oil and gas", "Robotics and drones", "Aerospace and defense", "Cloud and data centers", "Software and SaaS", the sector table in 3.3.2 | Use the 45 names in 10.3. |
| A6 | **Crypto outside the phone tab** | 3-markets 3.1.2, 3.2.5, 3.5.4, 3.8.2, 3.23; 4-politics 4.20.2 crypto mixing; 6 crypto mining | Cut, or point to 9-gambling. |
| A7 | **Insider hacking route** (4) | 6.3.4, 6.9.3, 6.9.4, 6.14.1 | Remove it (no insider bonus). |
| A8 | **Hacks on TC the victim doesn't own** | 6.9.3 "owns or leases"; 17.5 air-gapped software | Hacks target owned TC only. Air-gapped becomes a property of TC. |
| A9 | **Special licence terms** | 6.5.5 rent formula, 18.4 run-it-yourself, 15.5 reserved contracts, 14.6, 6.5.5 Data Sovereignty | One standard offer, usage pricing from 14.4, no residency rules. |
| A10 | **Tech levels and tech theft** (about 10) | 1-core 1.1.8; 4-politics C2, 4.9.7, 4.21.3, 4.26; 17.4; research tiers in 6 | Steal data, deals or plans. Tiers map to R&D and productivity. |
| A11 | **Physical units against "everything in dollars"** (about 10) | 6.1.1 wafer starts, 6.2.2 fab levels, 6.6.3 yields, 6.7.0 40M GPUs, 6.8.1, 6.14.2; 10.6 $1B = 150,000 H | Cut to dollar effects on business units. |
| A12 | **Compute units disagree** | H in 6.1.1, lease $2,500/H in 6.3.4, spot by hub tightness, 2,000 H per licence, generation price tier in 18.2 | One compute glossary in 15 (base, data and GPU units). Section 6 points to it. |
| A13 | **Plots, buildings, permits** | 4-politics 4.13.1 plot, 4.15.2 named plot, 4.31.2 tower; 2-map 2.5.10 permits, build index | Use district pools (2.16). |
| A14 | **Brand appeal and product demand** (dropped in batch 75) | 4-politics 4.16.2, 4.24.2; 5-ideology 5.2, 5.7.1, 5.7.2; 16.4 | Effect becomes Favorability or productivity. |
| A15 | **Single-player and AI rules** | 4.27.4 aggression setting (one difficulty); 4.18.1 AI ambitions (player only); 2.23 Raider "Acquire" (AI buys only on the director's order); 4.15.2 merger clearance (no antitrust) | Remove, or gate on the director. |
| A16 | **Death rolls** | 2.21.3, 2.21.8 plane crash "80% die" | Crashes cost health. Death comes at health 0. |
| A17 | **Start-world facts** | 4.2.4 lists Libya, Yemen and Sudan as failed and Myanmar, Burkina and Niger as juntas, and has Mali wrong; about 20 example hubs that don't exist; 2.8.0 says John "near the underclass"; mid-2020s FX values in 3-markets (USD 4%, JPY 150, gold $3,000) | Match 19.22 and January 2020 values. |
| A18 | **Disclosure lines** | 3.4.8 "5% everywhere" | First line 2 to 10% set by the F4 law; then 10, 25, 50. |
| A19 | **Control equals share majority** | 3.4.8 "50% makes it a vassal", 3.11 examples | Owner of record versus real controller (1.3.1). |
| A20 | **Playable rivals** | 12-setup 12.1 and 12.2 (pick from 15); 7.3 "easy start" and "playthrough" lines (6) | Only John Techno is playable. The rivals get AI goals. |
| A21 | **Turns and market hours** | design-doc "hourly turns", 09 "local hours, market close", 11-ui | Pausable real time with hourly ticks. Markets are open 24/7 and closed on 1 January. |
| A22 | **Dead links** (about 80) | to the overview stubs 01 to 10 (1.8, 2.6, 5.3, 8.5, 10.1, 10.2, 10.4) and 3.7 | Point to the detailed files. |
| A23 | **Small fixes** | 7 header "to 2030" (should be 2035); 7.7 duplicate election row; 7.8 Medellín L and Sydney XL, and "Colombia is the 31st country"; 7.10 numbering; 2.26 Vancouver and Munich called "candidates"; 1.10.2 "until central banks exist"; "efficiency" used for productivity; 16.7 Tokyo influencer quest line; 11.7 sex goes to "Media later"; 16.2 streamers called search platforms; nonexistent traits (Media Darling, Scandal-Ridden, Socialite, Loyal) | Fix each one. |
| A24 | **Overview files badly out of date** | design-doc.md (cites Victoria 3, turns, succession laws, "lose when the family loses it", build order), 09-time, 11-ui, 12-setup, 12-tech | Rewrite to the current design. Files 01 to 08 and 10 are current but thin. |

19-history is clean.

## Part B. Conflicts that need a ruling

1. **Semiconductors.** Memory says "one Semiconductors industry". The 45-industry list has Lithography machines, Foundry, GPUs and CPUs as separate industries, and file 15 draws parts from a "Semiconductors" industry that isn't on the list.
2. **Hubs in minor groups.** Medellín (Colombia) and Kolwezi-Lubumbashi (DR Congo and Zambia) are in minor groups, which breaks the "major countries only" rule.
3. **Succession laws.** Primogeniture and Partition still sit in 1-core 1.10.1 and 1.11.1, and politics relies on them. Logan's rule is that the player picks the successor.
4. **Branch offices.** They are still a vassal type that "unlocks host markets and hubs", but units can now spread across cities freely. The politics seizure ladder depends on them.
5. **Startup dashboard.** The 1.6.9 startup model (product points, Hype, churn) is a separate economy from business units.

## Part C. CK3 check

**Where it already works like CK3:**
- The realm is the corporation, with two-layer control.
- Vassal contracts cover autonomy, loyalty and levies (including the TC levy).
- The board works as the council.
- The charter works as realm law.
- Hooks, secrets, the Spymaster and schemes are in place, along with stress, health and hidden traits.
- Childhood focus, schools and marriage alliances with prenups are designed.
- Takeover tools (tenders, proxy fights, defenses) work as war.
- Hacking works as a scheme.
- Media can expose hidden control.
- Ideology works as faith (secret ideology, the Red Heir).

**What's missing or broken:**
1. **No claims or casus belli list, and no war loop.** There is no war score, no peace terms, no truce (standstill), and no call to arms for blocs or in-laws.
2. **Vassals can't revolt.** "Seek independence" has no mechanism (management buyout, a subsidiary board defying its parent), and there are no factions of vassals against the liege.
3. **No lifestyles or perk trees.** Perks come only from event traits. "Lifestyle coping" and "stress traits" are mentioned but never listed.
4. **Too many prestige-like measures.** Prestige, Clout, Renown, Image (Fame and Favor), reputation, Favorability, Elite Standing, Profile and Heat overlap. Only PC can be spent, so there is no prestige sink.
5. **No houses or cadet branches.** Politics uses them, but they are never defined, and the dynasty head's powers are thin.
6. **Schemes are scattered.** Politics invents about 6 schemes that the 1.1.8 table doesn't list, and "Mentor scheme" is cited but doesn't exist. Defense is defined in 6 places, and espionage in 3.
7. **Company succession when a head dies** is not defined beyond a value shock.
8. **The character loop is quiet at start.**
   - John's quest line is all business, with no courtship, family or succession arc.
   - His only trait isn't a personality trait, so stress never fires.
   - With 24 in every skill, his rolls succeed about 92% of the time.
   - The dynasty score rewards wealth, not the dynasty.
   - Generations are rare: John starts at 22, and nothing ages a character's health.
9. **Software, infrastructure and AI models are company spreadsheets** with almost no character hooks. Batch 87 removed licence deals, which were the obvious character hook.
10. **Heavy simulation that fights the character loop.** This covers population and unrest in 2, order flow, central banks, bank runs and CDS in 3, the fab and yield simulation in 6, and population ideology in 5.
