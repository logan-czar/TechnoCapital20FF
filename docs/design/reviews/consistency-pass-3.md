# Consistency pass 3 (batch 129, 2026-10-20)

Sweep of every doc for leftovers from the map rework (hubs, districts, regional and city government) and the currency rulings (USD simulation, flavor currencies, FX post-POC). Three workers applied 69 mechanical fixes; the coordinating session then fixed the Taylor-rule "stress" term (renamed market_calm), DR Congo's "dollarized" label, the chokepoint count (15 plus 2 bypass routes) and Silas Reed's governor link (now the Minister of Land and Housing). Rulings still open are asked as batch 130.

## Worker report: mappol

# Consistency pass 3 (batch 129): mappol

Files: /mnt/project-files/design/detailed/2-map-and-influence.md and /mnt/project-files/design/detailed/4-politics.md. I read both files in full and ran the brief's keyword greps. Both files were mostly clean already, because batches 118 to 125 had rewritten most of the stale wording. Historical status-line text and the "(batch N) ... removed" notes were left as they are.

## Part A: fixes applied (23)

### 2-map-and-influence.md (7)
1. Status line: added the "Consistency pass 3 (batch 129)" note.
2. 2.2.5 Papa's Port: "uses the US dollar like the rest of Latin America" (the superseded batch 124 dollarization) now reads "its flavor currency is the US dollar; as everywhere, every simulated value is in USD (batch 125)".
3. 2.3.3 key cities intro: removed the stale "'slice pending' means that superregion's province list is not built yet" clause. The map is complete and no row uses the label.
4. 2.5.7 gala row: "a push of 5 toward Friend with all city officials" now reads "with the national legislators elected in the city and one minister who attends (there are no city officials, batch 121)", which matches 4-politics 4.10.1 Host Gala.
5. 2.14.1 Penang setup: "(the former Penang hub; ...)" now reads "(a key city, 2.3.3; ...)".
6. 2.16.3 pool price formula: the "country's policy rate" term is now glossed as "in the POC the world base rate plus the country's spread (3-markets 3.8.1)".
7. 2.26 assumption 1: updated to the finished map. "3,200 provinces, 69 Metros in four slices, likely about 100" now reads "3,255 land provinces, 97 Metros (5M+ rule plus Dubai-Sharjah-Ajman, batches 119, 125, 128)". "Built superregion by superregion, North America first" now reads "complete (2026-10-20) in eight superregion files".

### 4-politics.md (16)
1. Status line: added the "Consistency pass 3 (batch 129)" note.
2. 4.1.1 Stability meaning: currency crises are now marked post-POC.
3. 4.1.3 Monthly cadence: "default and currency crisis risk" now reads "default risk (currency crisis risk is post-POC)".
4. 4.6.6 Market reaction: "(and its currency, once it has one)" implied the superseded re-currency rule. It now reads "(and, after the POC when FX is simulated, its currency; batch 125)".
5. 4.8.2 Yearly Plenum: "minister or province chief" now reads "a minister or a top party post; there are no province governments, batch 121".
6. 4.11.4 Ring-fence: "(in its local currency, if it has one)" now reads "(valued in USD like every value, batch 125)".
7. 4.11.7 Crisis band: "currency crisis chance x2" is marked (post-POC).
8. 4.11.8 Debt vassalage "How it starts": "default or a currency crisis" now reads "default (or, post-POC, a currency crisis)".
9. 4.12.1 Stage 3 corporate zone: "its own currency or scrip" is marked post-POC, with a pointer to 3-markets 3.8 (Arcology Scrip). In the POC the zone's money is USD.
10. 4.13.4 sanctions example: "compensation 30%, in B's money" now reads "paid in cash valued in USD", which matches 4.9.9.
11. 4.16.3 Clout table: "Currency Raider" is marked (post-POC).
12. 4.25 ISF powers: "loans in currency crises and defaults" now reads "in defaults (3.6.7) and, post-POC, currency crises (3.8.7)".
13. 4.25 ISF conditions: "F1 Independent" is marked (post-POC).
14. 4.25 "Blocs as a fourth level" now reads "Blocs as a level above national". The old count included the removed city and regional levels.
15. 4.27.1 crisis responses: "Rate rises if F1 allows" now reads "In the US, rate rises by the Federal Monetary Board (the only rate setter in the POC); elsewhere Essentials Capped price controls".
16. 4.27.1 crisis responses: "Currency crisis or default" now reads "Default (or, post-POC, a currency crisis)".

### Checked and left alone
- 2.2.3 DR Congo "Managed Float (heavily dollarized)": this is real-world flavor in the flavor FX column, not the superseded in-world dollarization.
- The "weight replaces hub mass" and "hub size classes ... replaced" lines are historical explanations.
- The 4-politics E6 and 4.9.8 "policy rate" terms already match 3-markets 3.8 (line 916): in the POC, the policy rate is the world base rate plus the country spread.
- The influence tiers (10/25/50, 5/15/30, 3/8/20), local standing PC (+2/+4/+8, single-province city counts once), Metros 2 to 8 from the 5M+ rule, contested flags, resource-band overrun, Russian federal-district areas, the EU, Norway, Iceland and Switzerland rules, Brexit on 31 Dec 2019, Federal Monetary Board rescue at Friendly, and the euro crisis as a debt crisis all match the rulings.

## Part B: rulings needed (6)

1. **4-politics 4.29 Market Maker endgame.**
   - Conflict: the condition is "control a central bank (a client governor under F1 Directed or Monetary Financing), a currency board, or a global exchange". F1 and currency boards are post-POC, and only the Federal Monetary Board sets a rate. So two of the three routes are unreachable in the POC, and the third, "control a central bank", now means only the Fed.
   - Options: (a) in the POC, the condition becomes a client chair of the Federal Monetary Board, or control of a global exchange (3.17.5), for 10 years; (b) only the global exchange route counts until FX ships; (c) drop the endgame until post-POC.
   - Recommendation: (a). It keeps the endgame meaningful, and a client Fed chair is a fitting Megacorp goal.

2. **4-politics 4.12.2 corporate sovereignty "Regional influence share" row (25% / 35% / 50%).**
   - Conflict: batch 120 lowered the region tiers to 5/15/30% because a region now weighs the honest sum of its provinces. The Stage 1 bar (25%) is near region Kingmaker, and Stage 3 (50%) is far above it, so the requirement is out of step with the new scale.
   - Options: (a) tie the bars to tiers: Stage 1 15% (Power broker), Stage 2 20%, Stage 3 30% (Kingmaker); (b) keep the numbers as deliberately hard; (c) drop the regional row, since regions have no government.
   - Recommendation: (a) (T).

3. **4-politics 4.13.5 insider tip example.**
   - Conflict: a client minister gives one week's notice of "a surprise rate cut". In the POC only the Federal Monetary Board sets a rate, and the country is unnamed. Its numbers (corruption 20) do not match the US (25).
   - Options: (a) make the tip a surprise tax or tariff change (the numbers stay the same); (b) make it a Fed cut leaked by a US minister and set corruption to 25 (the detection math shifts slightly); (c) leave it as is.
   - Recommendation: (a).

4. **2-map 2.4.2 chokepoint count.**
   - Conflict: 2.2.1 and assumption 1 say 14 chokepoints, but the table now has 17 rows after batch 124 added three. Drake Passage and Cape of Good Hope are marked "not a chokepoint", which leaves 15.
   - Options: (a) say 15 chokepoints plus 2 bypass routes; (b) re-confirm which rows count.
   - Recommendation: (a).

5. **2-map 2.26 assumption 18, "Other files to update".**
   - Conflict: this to-do list (7-starting-world hubs to provinces, 10-industry-economy fit per industry, 11-ui map modes) may be partly done, and I could not check it from my assigned files.
   - Recommendation: whoever swept those files should confirm, then prune or strike the done items.

6. **2-map 2.3.2 versus 2.17.4 Metro member rank (minor).**
   - Conflict: 2.3.2 says members "rank Metropolis", while 2.17.4 forms Metros from provinces of rank "City or Metropolis". Joining a Metro makes a province Metropolis by the rank table, so this is consistent in effect.
   - Recommendation: add "(a member takes rank Metropolis on joining)" to 2.17.4 if Logan agrees.

## Worker report: markets

# Consistency pass 3: markets (batch 129)

Files: 3-markets-and-fx.md, 1-corporate-core.md, 10-industry-economy.md, 6-technocapital.md.

Overall: no hub, district, regional government, mayor, governor (other than central bank governors), city council, municipal, size class, megacity, dormant or re-currency leftovers in live rules. Remaining hits are historical log text (status lines, "(was district; batch 118)", removed-section notes, the 3.27 assumption list), which were left alone. The leftovers found were currency wording that still read as if FX ran in the POC.

## Part A: fixes applied (24 edits)

### 3-markets-and-fx.md (18)
- Status line: added the Consistency pass 3 (batch 129) note.
- 3.1.4 rank table, Corporation row: "FX positions, carry trades and forwards" now marked post-POC (3.8).
- 3.5.4 margin table: the "FX position" row is marked post-POC.
- 3.6.1 bond fields: "currency" is now "currency (USD for every bond in the POC, 3.8.1)".
- 3.6.5 yield formula: "Government bonds in their own currency" is now "Government bonds (all in USD in the POC, 3.8.1)".
- 3.8.1 opening: "Every account, price and asset is denominated in a currency" is now prefixed "Post-POC," and adds "in the POC that currency is always USD".
- 3.9.2: "Central banks meet monthly" now adds that only the Federal Monetary Board's meeting sets a rate in the POC.
- 3.9.3: the FX fair value and carry-trade line is marked post-POC.
- 3.9.7 Capture: "a woken national bank is the smaller prize" (the superseded dormant or woken idea) is now "post-POC, when other central banks set rates (3.8.1), a national bank is the smaller prize".
- 3.12 links table, Trusts row: "account currencies (all USD at start)" is now "all USD; other account currencies are post-POC".
- 3.12 Industry economy row: "once currencies exist" (currencies exist as flavor) is now "once FX is added (post-POC, 3.8.1)".
- 3.12 Politics row: "debt and currency crises" is now "debt crises (currency crises are post-POC, 3.8.7)".
- 3.17.3 deposit insurance: "$250,000 (or the local equivalent)" is now "$250,000 in every country (every value is in USD, 3.8.1)".
- 3.18.3 personal office allocation: "by region and currency" is now "by region (and, post-POC, by currency)".
- 3.23.4: Arcology Scrip reference marked post-POC.
- 3.25.1 Megacorp row: "currencies" in the world view is marked post-POC.
- 3.25.1 Megacorp row: "corporate scrip into Arcology Scrip" is marked post-POC.
- 3.25.2 Megacorp rivals: "Peg defenses aimed at the player" is marked post-POC.

### 1-corporate-core.md (2)
- Status line: added the Consistency pass 3 note.
- 1.10.2 and 1.13: "3-markets 3.9 is post-POC" (wrong, since 3.9 also holds the live Federal Monetary Board rule) is now "their rates in 3-markets 3.9 are post-POC". This is one replacement used twice.

### 10-industry-economy.md (2)
- Status line: added the Consistency pass 3 note.
- 10.5.3 Borrowing: "at their home country's base rate plus a spread for their credit rating" (implied a national rate) is now "at the Federal Monetary Board's world base rate plus their home country's spread and a spread for their credit rating (3.6, 10.0.9)", which matches 10.0.9.

### 6-technocapital.md (2)
- Status line: added the Consistency pass 3 note.
- 6.7.5 Gigaclusters: "+2 influence weight in the province" (a hub-mass era phrasing that clashes with the dollar place weight of 2.3.1 and 2.5.3) is now "its assets count ×2 toward influence in the province (6.8.2)", which matches 6.8.2.

## Part B: rulings needed (none blocking)

1. **3-markets 3.9.2, Taylor rule term "stress".** The rule's GRG term is named `stress`, which echoes the removed character stress (batch 117). It is a different thing, but the name could confuse. Options: (a) keep the name; (b) rename it to `calm` or `riskoff`. Recommendation: (b), a rename only, with no rule change.
2. **3-markets 3.8.1 currency table, CDF row "Role: ... dollarized".** This describes real DR Congo, not the superseded world-dollarized reading, but it uses the banned word. Options: (a) keep it; (b) reword to "runs mostly on USD" (as the Regime column already says). Recommendation: (b).
3. **3-markets 3.6.3, rating factor "Issuer of a reserve currency +2".** This is kept although currencies are flavor (already marked A, batch 125). Options: (a) keep it as a flavor-driven rating bonus for the US, euro countries, Japan, UK and Switzerland; (b) fold it into the calibration offset and drop the row in the POC. Recommendation: (a). It is cheap and keeps the euro core's spreads sensible, but it should be confirmed.
4. **3-markets 3.9.7 lobbying and capture in the POC.** The "Lobby the government", "Appointments" and "Change the law" routes still read as working on every country's bank. In the POC only the US route moves a number; for other countries they change flavor posts only. Options: (a) leave the banner at 3.9 to cover it; (b) add a line that non-US routes are post-POC except appointments as political posts. Recommendation: (b), one line, if Logan agrees.
5. **Outside my files, for the coordinator.** MEMORY.md (batch 118 MAP line) still says Metros have a "shared council". Batch 121 and the 2-map status line say a Metro shares only its property cycle and post-POC metro systems. The memory line should get a note that the council was removed in batch 121.

## Worker report: rest

# Consistency pass 3 (batch 129): label "rest"

Files swept: detailed/5, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19; overviews 01 to 12; design-doc.md; consistency-pass.md; drafts/na-characters.md.

No leftovers needing a fix were found in 8-quest-lines, 9-gambling, 11-addiction, 12-setup-and-score, 13-events, 14-software, 15-infrastructure, 16-media, 17-hacking, 18-ai-models ("size class" there is model size, not city size), 01, 02, 03, 04, 07, 09, 10 or 11-ui. consistency-pass.md is a batch 74 historical record (its "slop across hubs" line is a past call), so it was left alone.

## Part A: fixes applied (22 edits in 9 files; status lines marked)

1. detailed/5-ideology.md, 5.4.2: "Cairo-Suez" becomes "Cairo" (the Metro's name in provinces-mena.csv).
2. detailed/5-ideology.md, 5.9.3: strike chance reads the workers' segment in the unit's "base province (10.0.2)", not "base city" (10.0.2 says base province since batch 118).
3. detailed/7-starting-world.md, header: "Builds on 2-map (hubs, influence)" becomes "(map, influence)".
4. detailed/7-starting-world.md, 7.2.0 Banking row: "US policy rate about 3% at start (T)" becomes "world base rate, set by the Federal Monetary Board from US data, about 1.75% at start (T) (3.8.1)". This matches 3-markets 3.8.1 and the file's own 7.7 rows.
5. detailed/7-starting-world.md, 7.2 Interest rates row: same change (1.75% world base rate).
6. detailed/7-starting-world.md, 7.8 intro: development is no longer "seeded from the old size and district codes". It is now "set directly in the province data (2.3.2)", with province ids in the 2.3.3 key cities table, and the Old size column is labeled reference only.
7. detailed/19-history.md, 19.22 North America: "policy rate about 3%" becomes "the world base rate, set from US data, about 1.75% (3.8.1)". This is a mechanics value only.
8. detailed/19-history.md, 19.22 Sub-Saharan Africa: "Lagos the one possible hub" becomes "the one city that could rise into Africa's center (7.2.0)".
9. 05-map-and-influence.md: "about 3,200 land provinces" becomes "3,255 land provinces (data in data/, 8 superregion files)", and Metros are now "the 97 Metros".
10. 06-economy.md, Financing: "the central bank base rate plus a spread" becomes "the Federal Monetary Board's world base rate plus a country spread (every value in USD; FX post-POC)".
11. 08-politics.md: added the EU exception. The EU is a supranational body (4.25.1), Norway and Iceland follow its single market laws, Switzerland stands alone, and the UK left on 31 Dec 2019.
12. design-doc.md, pillar 4: "(or its currency, once it has one)" implied the superseded re-currency reading. It now reads "(and, after the POC, its currency)".
13. design-doc.md, systems diagram: "Laws, rates, FX" becomes "Laws, rates".
14. 12-tech-and-roadmap.md, roadmap step 6: "The province list starts with the North America test slice" now says the province data is complete (3,255 provinces, 97 Metros, 8 files) and that NA is the first test slice (A).
15. drafts/na-characters.md: "Age and hub" becomes "Age and city" (23 entries). The "What every entry has" line also changed "hub" to "city".
16. Status lines: "Consistency pass 3 (batch 129): ..." added to all 9 changed files.

## Part B: rulings needed (not edited)

1. **Liberals' top demand is a post-POC law (5-ideology 5.3.1, 5.3.10, 5.7.1; also 5.3.2).**
   - Conflict: 4-politics 4.5.4 makes F1 Central Bank Independence (and F3) post-POC and not simulated. Yet F1 Independent is the Liberals' ++ and their "Top demand" in 5.3.10, and movements form around the top demand (5.7.1). Communists also want F1 Monetary Financing. In the POC a Liberal movement could form around a law that does nothing.
   - Options: (a) make E5 Free Trade (their other ++) the Liberal top demand in the POC and tag F1 wants "(post-POC)"; (b) keep F1 as a law that can be voted but has no effect; (c) give Liberals a new POC ++ such as F4 Standard.
   - Recommendation: (a).
2. **US debt 60% vs 120% of GDP (cross-file; 3-markets is not my file).**
   - Conflict: 7-starting-world 7.2.0 and 19.22 give US federal debt as about 60% of GDP. The 3-markets 3.6.5 worked example uses "debt 120% of GDP" for the US 10-year at start.
   - Options: rework the 3.6.5 example at 60%, or call it illustrative.
   - Recommendation: rework the example at 60% (the alt-history is Logan's ruling). Flag this for whoever owns 3-markets.
3. **The 3% figure I replaced (7.2.0, 7.2, 19.22).**
   - "US policy rate about 3%" was an older (T) value. Batch 125 set the world base rate to 1.75% (T) and calls the US neutral rate 3.0%. I aligned the text to 1.75%.
   - Please confirm that Logan's "rates never went to zero" is satisfied by 1.75%. If he wants rates visibly higher than real 2020, raise the 3.8.1 base rate to about 3% instead and revert these three lines.
4. **na-characters #22 Silas Reed (drafts, line ~428): "A direct line to the governor's office"** and a premise of brokering deals "with the state". Texas has no governor in play (batch 121). This is outside my map-words-only scope.
   - Options: "a direct line to the Minister of Land and Housing" (or the federal Commerce ministry), or keep the governor as flavor with no mechanics.
   - Recommendation: national minister.
   - Also note 2-map 2.3.5 Dallas perk text "(Texas has no state tax)". It is flavor, but it implies state tax law; that is for the 2-map owner.
5. **design-doc Vision line "a living world economy of industries, stock markets, currencies and governments".** Currencies are flavor only in the POC. This could stay as vision prose or become "...stock markets and governments (currencies after the POC)". Recommendation: leave it, it is pitch text. Listed only for completeness.

