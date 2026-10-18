# 16. Media and entertainment (detailed design)

_Status: draft v0.1 (2026-10-18). Logan made media its own system in batch 50 (it is no longer one of the 45 industries) and set its shape in batch 65: **five kinds of media business**, **media campaigns** that pay creators for a set effect, owner **editorial control**, content **projects that roll for hits**, and **influencers as content creators**. Builds on [1-corporate-core.md](1-corporate-core.md) (Image: Fame and Favor), [10-industry-economy.md](10-industry-economy.md) (corporations, the Ads and Social media industries), [5-ideology.md](5-ideology.md) (ideology spread), [4-politics.md](4-politics.md) (scandals and news cycles) and [14-software.md](14-software.md) (contracts). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 16.9.

---

## 16.1 Decided by Logan

| Topic | Decision |
|---|---|
| Purpose | **Both a business and a power tool** (batch 65): media earns revenue, and it shapes Image, ideology, investor confidence and scandals. |
| Kinds of media business | **Print, streamers, studios, music labels and social media channels** (16.2). |
| Campaigns | Channels and creators **can be contracted to make media for a specific purpose**. Logan's example: a media campaign pays **10 influencers** to raise a company's **investor confidence by 1** (16.4). |
| Editorial control | **The owner sets the slant and can run or kill stories**; heavy meddling costs credibility (16.5). |
| Content | **Films, shows and albums are projects** with a budget and talent, and roll for hits (16.6). |
| Influencers | **Influencers are content creators** (16.7). |

## 16.2 The five kinds of media business (Logan)

| Kind | What it is (Logan) | How it earns **(A for the model)** |
|---|---|---|
| **Print** | Blogs, newspapers, publishers, magazines | Subscriptions and ads; breaks stories and scandals |
| **Streamers** | Video, music, search and adult platforms (YouTube-, Spotify-, Google-, Netflix-like and adult sites) | Subscriptions and ads on their audience; **buy shows and films from studios** and **pay labels per play** |
| **Studios** | **Create TV shows and movies and sell them to the streamers** | Licence fees from streamers, through contracts like software contracts (14.4): one-off sale, or a licence for a term, or an exclusive |
| **Music labels** | **Create music**, earn **revenue from plays on the streamers**, and run **concert tours** | Royalties per play from every streamer that carries the catalogue, plus tour income (16.6) |
| **Social media channels** | Content creators and their channels (16.7) | Platform ad share, sponsorships and **paid campaigns** (16.4) |

- **Outlets.** Each media business owns named **outlets** (a newspaper, a streaming service, a studio label, a record label, a creator's channel). An outlet has an **audience** by country, a **slant** (one of the nine ideologies or none), and **credibility** (0 to 100) **(A)**.
- **Ownership.** Outlets are held by corporations like business units (10.0) but sit in the media system, not one of the 45 industries. Their revenue and costs go on the owner's books; their audience, slant and credibility are what make them a power tool **(A)**.
- **Links to industries.** Streamers and social platforms run on software and compute (14, 15); ad revenue is shared with the Ads industry; the Social media industry stays the platforms' business side, while channels and creators live here **(A)**.

## 16.3 Audience and reach (A)

- An outlet's **audience** is a number of people per country, which grows with its content, its slant matching the local ideology mix, and marketing spend, and shrinks with scandals and lost credibility.
- **Reach** of a story or campaign = the audience it runs on × credibility ÷ 100.
- Every outlet's audience is split by **stratum** (2.8.0): print skews to the Nobles and Glitterati, social channels to the PMC class and the Permanent Underclass **(A)**.

## 16.4 Media campaigns (Logan)

A **media campaign** is a contract to make media **for a specific purpose**. The buyer (a character, company or party) contracts creators, channels or outlets, and the campaign delivers a set effect when it runs.

**Logan's example:** a campaign that pays **10 influencers** raises a company's **investor confidence by 1**.

| Purpose | Effect per unit of reach **(T)** | Typical buyers |
|---|---|---|
| **Investor confidence** | +1 per 10 influencers (Logan); about +1 per 1M reach on finance outlets | A company before earnings (3.1.0) or a raise |
| **Image** | Fame +1 per 1M reach; Favor +1 per 2M reach with matching slant | A character running for office or rebuilding after a scandal |
| **Product demand** | +1% demand for the buyer's business unit in one industry for 3 months | Consumer, gaming, luxury and e-commerce units |
| **Ideology** | Spreads one ideology in a country's segments (5) | Movements, parties, Zealots |
| **Smear** | A rival's Favor or investor confidence -1 per 2M reach; can start a scandal | Rivals; discovery makes it a scheme (1.1.8) |

- **Cost (A):** each creator charges by followers (about $1k per 10k followers per post) and each outlet by audience. A campaign runs 1 to 4 weeks.
- **Credibility matters:** effects scale with the creators' and outlets' credibility. Paying low-credibility accounts is cheap but weak, and a campaign exposed as paid loses its effect and costs the buyer Favor.
- **Campaigns stack with diminishing returns** on the same target and purpose in the same quarter (each further campaign at half the effect) **(T)**.
- Campaigns use the **contracts table** (14.4) and can be special contracts (an exclusive deal with a star creator).

## 16.5 Editorial control (Logan)

- **The owner sets each outlet's slant** to one of the nine ideologies or neutral. A slant pushes that ideology in the outlet's audience over time and pulls the outlet's audience toward people who share it.
- **Run or kill stories.** When a story about someone lands in the news (a scandal, a leak, a report, 4-politics news cycles), the owner of an outlet that has it can **run it** (full reach), **soften it** (half reach), or **kill it** (no reach from that outlet; other outlets may still run it).
- **Meddling costs credibility (A):** killing a story costs 5 credibility, running a story the owner planted costs 3, and changing the slant costs 10. Credibility recovers 1 a month.
- **Leaks:** a killed story can still leak from staff (an Intrigue roll by the outlet's editor), which makes the cover-up the story.

## 16.6 Content projects (Logan)

Studios and labels make **projects**: films, shows and albums (and tours for labels).

| Field | What it holds |
|---|---|
| **Budget** | The money spent, by tier: indie, mid or blockbuster **(A)** |
| **Talent** | Characters attached: a director, stars, musicians or a producer. Their Fame and skills raise the hit chance |
| **Genre and slant** | What it is, and any ideology it carries |
| **Time** | 6 to 24 months to make **(T)** |

- **Hit roll (A):** on release, the project rolls a result from Flop to Smash. The chance of a hit = 20% + talent Fame ÷ 5 + budget tier bonus (indie 0, mid +10, blockbuster +20) + Vril of the producer, clamped 5% to 70% **(T)**. A smash earns 3 to 10 times its budget; a flop loses most of it.
- **Selling to streamers:** a finished film or show is sold or licensed to streamers (16.2). A smash makes streamers bid against each other.
- **Music:** an album earns per play on every streamer that carries it, and a hit unlocks a **concert tour**: a project of 3 to 12 months that earns ticket and merch income in each hub it visits, and raises the artist's Fame.
- A hit gives everyone attached **Fame**, and a hit with a slant spreads that ideology.

## 16.7 Influencers are content creators (Logan)

- **Influencers are content creators**: characters (table or full, 1.1.0) who run their own social media channels.
- A creator has **followers** by country and platform, a **niche** (finance, gaming, lifestyle, politics and so on) and **credibility**. Followers are the creator's Fame in their niche.
- Creators earn from platform ad share, sponsorships and **paid campaigns** (16.4).
- A creator can be **signed** by a label, studio or a company (exclusive campaigns) under a contract.
- **Any character can become one**: a player or family member who posts builds followers from Persuasion and Hustle, and a big enough following turns a table character into a full one (1.1.0).
- The **Tokyo influencer** quest line (8) uses this system.

## 16.8 How it connects

| System | Link |
|---|---|
| Characters (1) | Campaigns move Fame and Favor; creators are characters; talent Fame drives hits |
| Markets (3) | Investor confidence campaigns before earnings; smears and scandals move prices |
| Economy (10) | Outlets on corporations' books; product demand campaigns; ad revenue shared with the Ads industry |
| Ideology (5) | Outlet slant and slanted hits spread ideologies |
| Politics (4) | News cycles and scandals run through outlets; parties buy campaigns |
| Software and infrastructure (14, 15) | Streamers and platforms are software on compute |
| Events (13) | A **Media** deck: *The Leak*, *Smash Hit*, *Box Office Bomb*, *Creator Scandal*, *Paid Post Exposed* |

## 16.9 Assumptions and open items

1. Outlets with audience, slant and credibility, and how they sit on a corporation's books (16.2).
2. Revenue models for each kind of media business (16.2).
3. Audience by country and stratum, and reach (16.3).
4. Campaign effects, costs, credibility and stacking beyond Logan's example (16.4).
5. Credibility costs of meddling (16.5).
6. Budget tiers and the hit roll (16.6).
7. Followers, niches and signing creators (16.7).
