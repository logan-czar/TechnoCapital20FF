# 11. Addiction: detailed design

_Status: draft v0.3 (2026-10-18). Batch 116: therapy is a monthly cost with no hours; sex has no Media route (no adult media); illegal vices run as Black market units; no partners or marriage. v0.2, consistency pass, batch 74: four vices (no cyberware), no daily hours budget. v0.1 (2026-10-17): from Logan's answers in the design Q&A (batch 28). Characters can be addicted to four vices. Every vice has a real benefit, which is why characters use them. Builds on [1-corporate-core.md](1-corporate-core.md) (stress 1.1.5, health 1.1.9, hooks 1.1.4) and [9-gambling.md](9-gambling.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 11.8.

---

## 11.1 Decided by Logan

| Topic | Decision |
|---|---|
| Scores | One addiction score per vice, with urges, withdrawal and relapse events. |
| Vices | **Gambling, drugs, doomscrolling and sex**. |
| Benefits | Anything addictive has a benefit to using it: stat boosts from drugs, returns from gambling, stress relief from doomscrolling and sex. |
| Hooks | A hidden addiction is a secret, so it can become a strong hook (1.1.4). |
| Recovery | Rehab clinics, therapy and willpower checks, with a relapse chance for years. |
| Profit | Vices are businesses (casinos, drug fronts, attention apps), with a scandal risk. Players can exploit hooks or bring a character's vices to the negotiation table. |

## 11.2 The four vices

Each vice has a **use** action (or happens through normal play), a **benefit**, and costs that grow with the addiction score.

| Vice | How it is used | Benefit **(T)** | Cost per use **(T)** |
|---|---|---|---|
| **Gambling** | Casino and prediction market bets in the phone tab (9) | The winnings (or losses) themselves; a win gives -10 stress, a big win also +5 Fame | The stake; a loss gives +5 stress |
| **Drugs** | "Use" action, by drug (11.3) | A stat boost for a set time | Money, health, a crash afterwards |
| **Doomscrolling** | 1 hour on the phone tab feed | -10 stress per hour (max -30 a day); a 10% chance per hour of a useful rumor (market news a day early, or a character's secret) | The time; at high scores, -1 Operations while addicted |
| **Sex** | Seduce scheme, lovers (1.1.4), paid services | -20 stress; a +5 push with the partner | Scandal risk if discovered (affairs, paid services); lovers become hooks |

## 11.3 Drugs (A)

| Drug | Boost | Lasts | Crash afterwards | Health per use |
|---|---|---|---|---|
| Focus stims | +3 Finance, +3 Operations | 1 day | -2 to both for 1 day | -1 |
| Social powder | +4 Persuasion, -2 Intrigue | 1 evening (a gala or meeting) | +10 stress | -1 |
| Neuro-dust | +3 Tech; ticking actions take 20% less time that day | 1 day | Ticking actions take 40% longer the next day | -2 |
| Downers | -30 stress | Immediate | -1 to all skills for 1 day | -1 |
| Longevity cocktails | +2 health a month (above the age cap by 5) | Monthly, $100,000 | None; addictive like the rest | 0 |

Legality varies by country (4.x): using an illegal drug is a secret, and buying it in bulk funds Black market units (10.3).

## 11.4 Addiction score

Each character has a score from 0 to 100 for each vice **(T)**.

- Each use adds to the score: gambling +2 per session (+5 after a big loss), drugs +3 to +6 by drug, doomscrolling +1 per hour, sex +2 per encounter.
- The score falls 2 a month when the vice is not used.
- Traits change the gain: Hedonist ×1.5, Ascetic ×0.5, Diligent ×0.8, Narcissist ×1.3 for doomscrolling **(T)**.

| Score | Level | Effects **(T)** |
|---|---|---|
| 0 to 24 | **Casual** | Only the benefit and the cost per use |
| 25 to 49 | **Habit** | Urges: a monthly event pushes the character to use; refusing costs +10 stress |
| 50 to 74 | **Addicted** | Benefit ×0.7 (tolerance); urges weekly; withdrawal when not used for a week: +15 stress and -1 to all skills until used; money drain (drugs and gambling: 5% of personal account income a month) |
| 75 to 100 | **Dependent** | Benefit ×0.5; withdrawal after 3 days: +25 stress, -3 to all skills, -2 health a week; the character uses on their own unless the player spends a willpower check each week; public incidents possible (Favor -10) |

**Withdrawal and relapse events.** Withdrawal fires as an event with options (use, push through with a willpower check, seek help). Relapse events fire for characters in recovery (11.5).

**Willpower check (T).** Success = 40% + (highest of Operations or Persuasion) × 2% + 10% if Diligent or Ascetic - 15% if Hedonist - score ÷ 4 %, clamped 5% to 90%.

## 11.5 Recovery

| Option | Cost **(T)** | Effect **(T)** |
|---|---|---|
| **Willpower** | Time: skip the vice and pass weekly willpower checks | -5 score per week passed |
| **Therapy** | $20,000 a month (weekly sessions resolve instantly, no hours) | -10 score a month; +10% to willpower checks |
| **Rehab clinic** | $250,000 and 4 weeks away (the character can only act through delegates) | Score set to 10; status "in recovery" |

- **In recovery**: for 3 years after rehab, or after the score falls under 10 from willpower or therapy, a relapse event can fire each quarter (10% chance, ×2 at stress level 2 or higher, ×2 when a rival offers the vice) **(T)**. A relapse sets the score to 40.
- Going to rehab is public unless hidden (a secret, and a hook if found). Glitterati and above lose 10 Favor if it becomes known; some audiences gain sympathy (+5 Favor with Liberals and Effective Altruists) **(A)**.

## 11.6 Secrets, hooks and the negotiation table

- **Hidden addiction**: any vice at Habit or higher that the character hides is a **secret**. Dig up dirt (1.1.8) on them can find it and give a strong hook.
- **Exploit a hook** (Logan): call the hook to force an action, as in 1.1.4.
- **Bring their vice to the table** (Logan): in any negotiation (a deal, a vote, a board seat, a stake sale), the player can offer the other character's vice instead of money: a weekend in a private casino, a supplier for their drug, a companion. The offer counts as a payment worth (their score ÷ 10) × 1% of the deal, minimum $100,000 of value, and raises their score as a use **(T)**. Honest characters at Casual refuse and get a negative push toward the player; Addicted and Dependent characters almost never refuse.
- **Enable or cut off**: owning a character's supplier (their casino, drug front) lets you raise prices, cut supply (forcing withdrawal) or keep them dependent. Each is a scheme with discovery risk.

## 11.7 Vice businesses

Vices are businesses (Logan). They use the industry model ([10-industry-economy.md](10-industry-economy.md)):

| Vice | Industry | Legal? | Scandal risk |
|---|---|---|---|
| Gambling | Gambling (crypto casinos included) | Licensed in most countries | Low; higher for crypto casinos |
| Drugs | Pharma for legal stimulants; Black market (drug fronts, 10.3) for illegal ones | Varies | High for fronts: raids and investigations |
| Doomscrolling | Social media | Legal | Low; regulation and youth-harm scandals |
| Sex | Black market (escort and companion services where illegal); there is no adult media ([16-media.md](16-media.md), batch 66) | Varies | High where illegal |

- **Scandal risk**: a company in a vice industry has a yearly scandal chance (2% to 20% by row) **(T)** that costs Favor for its head and board, stock price -5% to -20%, and opens regulator action.
- **Owning the supply**: a company that sells a vice in a hub sees which named characters there are Habit or higher with it (their trait is no longer hidden from the owner), which makes vice businesses a source of hooks.
- **Slop**: vice industries carry high slop ratios (10.3); the Underclass's slop includes freemium gambling and feeds (2.8.0).

## 11.8 Assumptions and open items

1. Four vices: AI addiction (Logan, batch 72) and cyberware (batch 71) are not vices.
2. The drug list and boosts in 11.3.
3. Score gains, levels and the willpower formula in 11.4.
4. Recovery costs and relapse chances in 11.5.
5. The value of offering a vice at the negotiation table in 11.6.
6. Vice industries and scandal rates in 11.7.
