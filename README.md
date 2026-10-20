# LookMates

> **Tagline:** *Different styles. One perfect moment.*  
> **Hackathon Track:** YouCam API Skin AI & eCommerce VTO Hackathon — DuoMatch (CoupleMatch) Feature

---

## 1. Product Overview

**LookMates** is a collaborative fashion coordination and virtual try-on web application designed to solve a universal challenge: **helping two people coordinate their outfits for a shared occasion and visualizing the result before purchasing or wearing them.**

Users select an occasion (such as a wedding, date night, or cocktail party), enter style preferences and a combined budget (supporting INR for Indian users or USD), upload individual photos, receive occasion-aware AI styling recommendations, select garments from a curated catalogue, run independent virtual try-on jobs powered by **YouCam's apparel VTO API**, and compose the returned results into a **single downloadable side-by-side couple portrait (Option A)**.

> **Note on Scope:**  
> In accordance with the hackathon master development instructions, **DuoMatch** is 100% complete, tested, and fully demonstrable. **CrewMatch** is an intentionally blank placeholder in the navigation and is not implemented.

---

## 2. Tech Stack & Architecture

| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 15+ (App Router, Turbopack) | Server & Client Components, Route Handlers, TypeScript |
| **Styling** | Pure Vanilla CSS Neo-Brutalism | Electric cobalt (`#1764FF`), deep blue (`#0D47D9`), obsidian (`#080B10`), visible black grid lines (`linear-gradient`) |
| **Database** | SQLite via Node.js Native `node:sqlite` | Persistent sessions, participants, catalogue, try-on jobs, compositions, lookbook |
| **VTO Integration** | YouCam Perfect Corp S2S v2.0 Clothes API | Asynchronous task creation, polling, independent person jobs, targeted retries |
| **AI Stylist** | LookMates SmartMatch Engine / Gemini API | Complementary occasion palettes, coordination rationale, budget breakdown, item locking |
| **Composition** | Deterministic HTML5 Canvas (Option A) | 1500 × 1000 px 3:2 landscape couple canvas with Neo-Brutalist frame and PNG export |

---

## 3. Neo-Brutalist Design Tokens

LookMates strictly adheres to the non-negotiable Neo-Brutalist visual design system:

```css
:root {
  --blue: #1764FF;        /* Primary electric cobalt blue */
  --blue-dark: #0D47D9;   /* Deep interactive blue */
  --black: #080B10;       /* Obsidian black */
  --white: #FFFFFF;       /* Crisp surface white */
  --surface: #F7F9FC;     /* Soft neutral background */
  --text: #101318;        /* High-contrast dark typography */
  --muted: #667085;       /* Secondary neutral */
  --border: #111827;      /* Solid 1.5px/2px borders */
  --grid: rgba(8, 11, 16, 0.08); /* Visible technical grid pattern (24x24px) */
  --success: #15803D;
  --error: #DC2626;
  --shadow-neo: 4px 4px 0px #080B10;
}
```

---

## 4. YouCam Apparel VTO S2S v2.0 Integration

### Endpoint Specification
- **Base URL:** `https://yce-api-01.makeupar.com`
- **Authentication:** `Authorization: Bearer <YOUCAM_API_KEY>` (securely maintained server-side)
- **Task Submission:** `POST /s2s/v2.0/task/cloth`
  - `src_img`: Participant portrait / full-body image URL or Base64
  - `ref_img`: Selected garment image URL or Base64
  - `garment_category`: `upper body`, `lower body`, `full body`, `outer`, `shoes`, or `auto`
  - `change_shoes`: `false` (or `true` for full body swaps)
- **Polling Endpoint:** `GET /s2s/v2.0/task/cloth/{task_id}`
  - Returns `task_status`: `"processing"`, `"success"` (with `result_url`), or `"error"`.

### Independent Job Processing & Targeted Retry
YouCam receives separate person-specific try-on inputs:
- **Job A:** Person 1 ID + Person 1 photo + Person 1 garment
- **Job B:** Person 2 ID + Person 2 photo + Person 2 garment

If Person 1 succeeds and Person 2 fails, Person 1's result is preserved and only Person 2's failed job is retried via `POST /api/tryon/{jobId}/retry`, preventing redundant or costly duplicate API calls.

### Demonstration Fallback Mode
When `YOUCAM_API_KEY` is not supplied or is empty in `.env.local`, the server runs in **Demonstration Fallback Mode**:
- Tasks simulate asynchronous processing with high-fidelity realistic try-on results.
- A clear diagnostic status banner informs reviewers that the application is operating in mock fallback and instructs where to add the live API key.

---

## 5. Single Couple Image Composer (Option A)

LookMates combines the two returned YouCam try-on images into a single coordinated image using **Option A (deterministic image composition)**:
- HTML5 Canvas renders a 3:2 landscape layout (1500 × 1000 px).
- Features LookMates brand wordmark, occasion label, participant identification, outfit descriptions, and a technical Neo-Brutalist grid border.
- Cross-origin CDN images are streamed through a dedicated proxy (`/api/proxy-image?url=...`) with CORS headers to eliminate browser canvas tainting.
- Outputs a valid, high-resolution PNG downloadable as `lookmates-duomatch-couple.png`.

---

## 6. Getting Started & Local Development

### Prerequisites
- Node.js v22.5+ (recommended, includes native `node:sqlite`)
- npm v10+

### Installation & Run

1. Clone or open repository:
   ```bash
   cd LookMates
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your YouCam Bearer Token if available:
   ```env
   YOUCAM_API_KEY=your_real_youcam_token_here
   YOUCAM_API_BASE_URL=https://yce-api-01.makeupar.com
   DATABASE_URL=./lookmates.db
   ```

4. Start Development Server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. Run Production Build & Type Check:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

6. Run Automated Verification Test Suite:
   ```bash
   npx tsx scripts/test-duomatch.mjs
   ```

---

## 7. Complete Demonstration Flow (Hackathon Storyboard)

1. **Home (`/`)**: Click **"Start DuoMatch"**.
2. **Occasion Setup**: Select *Wedding Guest*, style *Modern & Elegant*, budget `₹25,000 INR`, colors *Navy & Cream*.
3. **Photo Uploads**: Upload front-facing photos for Person 1 and Person 2, or click **"Use Demo Couple Photos"** for instant sample portraits.
4. **AI Styling**: Review occasion-aware recommendations, inspect the coordination rationale, and optionally lock an item.
5. **Garment Assignment**: Browse the curated catalogue (Navy Blazer, Cream Trousers, Sapphire Gown) or upload a custom garment. Assign items to Person 1 and Person 2.
6. **Try-On (YouCam)**: Watch separate S2S jobs process for both participants with live status updates.
7. **Couple Composer (Option A)**: Inspect the high-res 3:2 canvas composition. Click **"Download PNG"** to save `lookmates-duomatch-couple.png`.
8. **Save to Lookbook**: Click **"Save to Lookbook"**, then navigate to `/lookbook` to see persistent looks, rename them, or reopen full-res previews.
9. **CrewMatch Navigation**: Click **CrewMatch** in the navbar to verify it displays the designated intentional empty placeholder.

---

## 8. License

LookMates is developed for the YouCam API Skin AI & eCommerce VTO Hackathon.
All rights reserved.
