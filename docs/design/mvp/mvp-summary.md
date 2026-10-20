# TechnoCapital20FF MVP in Plain English

*Based on MVP spec v1.3 (20 October 2026).*

## What the MVP is

The MVP (minimum viable product, the smallest version worth building) is a map and a business simulation that you watch but do not play. You see the world through John Techno's Pdoomberg subscription, starting on 1 January 2020. Every company is run by a "lite AI", a simple set of rules that only manages that one company. The goal is to prove the companies can run on their own and still produce believable numbers.

## The map

The world is split into 3,255 provinces across 211 countries. Every country belongs to one of 26 financial zones. A financial zone is a group of nearby countries that share one stock exchange in a hub city, such as New York, Frankfurt or Tokyo. Each province has a weight, based on its development and its country's wealth per person, which decides how likely new companies are to start there.

## Companies

The game starts with 651 real-looking companies. Each one has a single business unit (its operations in one industry) at its headquarters. Boards are filled by characters. Full characters are detailed people with skills and personality traits. Partial characters are simple fillers who just hold a seat and always make the default choice.

A company's size is counted in labor units, one for every $100,000 of business assets. Labor units fill up to five board seats and staff the company's work. Productivity measures how efficient a company is. It slowly falls unless the company spends on R&D (research and development). Companies also collect data from their sales. Stored data gives free R&D.

## The economy

All 42 industries use the same default numbers for now, to be tuned one by one later. One global business cycle moves through four phases: expansion, overheating, contraction and recovery. Each zone feels it more or less strongly. Every quarter each industry's growth wobbles, but it always drifts back toward its long-term rate. This is called mean-reverting growth.

Two big scripted events shape the long game. An AI boom starts on 1 January 2030, when AI labs suddenly grow very fast. The AI bubble pops around 2040, cutting AI demand in half.

## Money and markets

Everything runs on a quarterly cycle: companies report earnings, the market reacts, then each company locks its next plan. Companies produce simple income, balance sheet and cash flow statements.

Each company has a fair value, the engine's estimate of what it is really worth based on profit, growth and assets. Share prices move hourly, drift toward fair value, and jump when earnings beat or miss expectations.

Companies borrow through a credit line, a flexible bank loan. Their interest rate depends on their credit rating and their home spread, which is the extra borrowing cost of their zone and their country, half each. Each zone's exchange also has an investor confidence score that nudges share values up or down by up to 10%.

## New companies

New companies come from startup events. Random events happen about twice a quarter and favor fast-growing industries. Nine fixed events are tied to history, such as five new AI labs when the boom begins. Each startup brings its own new full and partial characters.

Once a private company is big and healthy enough, its board votes on an IPO (initial public offering, its first listing on a stock exchange). Each member's traits sway their vote. Ambitious and greedy members lean yes, while paranoid and cautious members lean no. At most three companies list per quarter.

## What you see

All screens are read-only, with action buttons locked. You get:

- The main screen with time controls (pause and five speeds)
- The map, with political, development, industry, company and financial zone views
- Company pages (overview, board, owners, finances, tech)
- The industries table
- The Pdoomberg terminal for quotes, charts, filings and ratings
- The quarterly recap
- A news feed

## What is not in the MVP

There is no personal play, trading, politics, media, hacking, gambling or phone, and characters do not age or die. These come later.
