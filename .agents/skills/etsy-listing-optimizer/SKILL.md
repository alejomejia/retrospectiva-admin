---
name: etsy-listing-optimizer
description: >
  Generate and optimize Etsy product listings for maximum search visibility, following
  official Etsy Seller Handbook best practices (updated August 2025). Use this skill whenever
  the user asks to: create an Etsy listing, write a product listing for Etsy, optimize an
  existing Etsy listing, improve Etsy SEO, write Etsy titles/tags/descriptions, or anything
  related to being found on Etsy search. Also trigger when the user mentions their Etsy shop
  and wants help with product copy, visibility, discoverability, or ranking. This skill
  encodes the complete Etsy search algorithm logic — always use it rather than guessing.
---

# Etsy Listing Optimizer

Generates fully optimized Etsy listings that maximize search visibility based on how
Etsy's search algorithm actually works. Source: Etsy Seller Handbook, August 2025.

---

## How Etsy Search Works (Essential Context)

Etsy search has **two phases**:

1. **Query Matching** — Etsy checks titles, tags, attributes, categories, descriptions, and
   first photo to find listings that match a shopper's query. All 13 tags + all relevant
   attributes + most specific subcategory = more chances to match.

2. **Ranking** — Among matched listings, Etsy ranks by:
   - **Relevancy**: exact-match keywords rank higher
   - **Listing quality**: photos, return policy, click-through + conversion rate
   - **Shop quality**: shop icon, branding, completeness
   - **Customer service**: review rating, message response rate (<48h), on-time shipping,
     low case rate (last 3 months)
   - **Shipping price**: lower shipping = better ranking (especially for US sellers)
   - **Recency**: new listings get a small temporary boost
   - **Shopper habits**: Context Specific Ranking (CSR) personalizes results per buyer

> Star Seller badge does NOT directly affect ranking order, but boosts buyer trust and
> conversions. Etsy Plus does NOT affect search ranking.

---

## Listing Generation Workflow

When asked to create or optimize a listing, follow these steps in order:

### STEP 1 — Gather Product Information

Ask for (or extract from user input):
- What is the product? (type, what it does, what it's for)
- Materials, techniques, dimensions/sizes
- Who is it for? (gift recipient, occasion, demographics)
- Style/aesthetic (minimalist, rustic, boho, art deco, etc.)
- Any personalization/custom options?
- Price point and shipping approach
- Shop language (default: English)

If the user provides a product description or existing listing, extract this info from it.

### STEP 2 — Keyword Research Mindset

Before writing anything, mentally map keywords across 7 categories:

| Category | Examples |
|---|---|
| Descriptive | what the item literally IS (multi-word phrases) |
| Materials & techniques | hammered gold, hand-embroidered, reclaimed wood |
| Who it's for | gifts for boyfriend, teacher gift, gifts for newlyweds |
| Occasion | bachelorette party, stocking stuffers, first anniversary |
| Solution-oriented | closet organization, workout headbands, lunch box decal |
| Style/aesthetic | art deco lamp, minimalist ring, rustic wall decor |
| Size/shape | large beach bag, toddler pants, shallow basket |

Target **long-tail keywords** (more specific = lower competition, higher conversion).
Avoid generic single-word tags like "ring" or "bag" — use "minimalist gold ring" instead.

### STEP 3 — Category & Attributes

- Choose the **most specific subcategory available** (it auto-includes all parent categories)
- Add **every relevant attribute** — even if less precise (e.g., add "pink" even if you'd
  say "magenta"; add "plants & trees" even if you'd say "nature inspired")
- Do NOT repeat exact attribute phrases in tags (waste of a tag slot)

### STEP 4 — Write the Title

Rules:
- Lead with the most descriptive keyword (what the item IS)
- Keep it **short, clear, scannable** — shoppers see only the first few words on mobile
- Include key differentiators (material, style, personalization)
- Use punctuation/pipes to separate phrases — Etsy reads each phrase independently
- DO NOT keyword-stuff (confuses buyers, hurts conversions)
- Max ~140 characters

**Bad title pattern:** `Dad T-Shirt | Father Shirt | Personalized Father's Day Gift | Personalized Dad T-Shirt | Dad Statement Shirt`

**Good title pattern:** `Personalized 100% Cotton Dad T-Shirt: Custom Kids' Names, S–XL`

### STEP 5 — Write All 13 Tags

Rules:
- Use ALL 13 slots — each is a search match opportunity
- Each tag: up to **20 characters**, multi-word phrases preferred
- All 13 should be **unique** — no repeated phrases between tags
- Do NOT repeat exact category/attribute phrases
- Do NOT add misspellings
- Do NOT use multiple languages (Etsy translates automatically)
- Do NOT worry about plurals (Etsy handles root-word matching)

Spread tags across different keyword categories (descriptive, occasion, recipient,
style, material, solution, size). Aim for variety, not repetition.

If a target phrase exceeds 20 characters, break it into multiple complementary tags
that together cover the phrase (e.g., "minimalist diamond engagement rings" →
`minimalist jewelry` + `diamond ring` + `engagement ring`).

### STEP 6 — Write the Description

Structure:
1. **First 1–2 sentences**: naturally incorporate 2–3 top keywords in human-readable prose
   (do NOT copy-paste the title; do NOT keyword-dump)
2. **Essential details**: sizes, dimensions, colors, materials, ordering instructions
3. **Brand story / product story**: end with what makes this special, written in your voice

SEO note: Etsy now uses description keywords for query matching AND external search engines
(Google, etc.) crawl it. Lead with keywords, but write for humans.

### STEP 7 — Photos Checklist (Output as Guidance)

The first photo is critical for clicks in search results. Recommend:
- [ ] First photo: clean, well-lit, item clearly visible (determines CTR from search)
- [ ] Photos 2–4: different angles, close-ups of details/materials
- [ ] Scale/lifestyle photo: item in use or styled in a room
- [ ] Size reference photo (next to common object or on model)
- [ ] Variation photos (if applicable: colors, sizes)
- Up to 10 photos — more photos = more buyer confidence = better conversion

### STEP 8 — Conversion Optimization Notes

Always include these reminders:
- Set **accurate processing time** (no unnecessary padding)
- Add a **return policy** (missing return policy hurts search ranking)
- **Low shipping price** improves ranking — consider building some shipping cost into
  item price
- Respond to messages **within 48 hours** (affects customer service score)
- Offer **free shipping** if viable (gets priority placement in Etsy app)

---

## Output Format

Produce the listing in this exact structure:

```
## TITLE
[title here — max ~140 chars]

## CATEGORY
[most specific subcategory path, e.g. Jewelry > Rings > Statement Rings]

## ATTRIBUTES
[list all recommended attributes with values]

## TAGS (13)
1. [tag 1]
2. [tag 2]
...
13. [tag 13]

## DESCRIPTION
[full description — keywords in first sentences, details in middle, brand story at end]

## PHOTOS TO SHOOT
[numbered list of recommended photo angles/contexts]

## CONVERSION TIPS
[any specific tips for this product type]
```

---

## Quality Checklist Before Delivering

Before outputting the final listing, verify:

- [ ] Title leads with the item name, is scannable, not stuffed
- [ ] All 13 tags are filled and unique
- [ ] No tag exactly repeats a category or attribute phrase
- [ ] No tag exceeds 20 characters
- [ ] Tags span at least 4 different keyword categories
- [ ] Description first sentences include keywords naturally
- [ ] Description is written for a human buyer, not a search engine
- [ ] Most specific subcategory recommended
- [ ] All relevant attributes listed
- [ ] Return policy and processing time mentioned in tips
- [ ] Shipping strategy noted

---

## When Optimizing an Existing Listing

If user provides an existing listing to improve:
1. Audit against the checklist above — identify gaps
2. Check tags: Are all 13 used? Are they varied? Any wasted on category repeats?
3. Check title: Is it stuffed? Does it lead with the item name?
4. Check description: Does it lead with keywords? Is it human-readable?
5. Suggest specific rewrites with rationale

Read `references/etsy-search-deep-dive.md` for more detail on the ranking algorithm
and advanced strategies (CSR, vacation mode, shop stats analysis).

---

## Important Reminders

- Searching for your own listings is **not a reliable way to track ranking** — results are
  personalized per shopper (CSR). Use Shop Stats instead.
- Renewing listings just for the recency boost is **not an effective strategy**.
- Never use misleading descriptors (e.g., calling synthetic fabric "cashmere") — violates
  Etsy's House Rules and can get listings removed.
- If the shop is multilingual, adding your own translations outperforms Etsy's auto-translate.