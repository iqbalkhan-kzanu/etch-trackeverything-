# ETCH

**Every action item, traced like a lot on the line.**

A centralized action item tracker built for the Tata Electronics Dholera fab —
one system to log, own, escalate, and verify the actions coming out of
governance reviews, audits, project discussions, and leadership meetings,
so nothing gets lost across chats, emails, and spreadsheets.

Built as a hackathon project, currently in pilot with the 34-member New
Joinee cohort across 5 teams (FMCS, HVAC, GAS-CHEM, UPW, ELECTRICAL).

---

## Live problem it solves

| Requirement | Status |
|---|---|
| Centralized action item repository | ✅ Done |
| Ownership & deadlines (accountability) | ✅ Done |
| Closure verification (separate verifier + evidence) | ✅ Done |
| Automated reminders & escalation | 🔲 In progress |

---

## What's built

- **Landing page** — fab-themed intro to ETCH with the process flow (Open →
  In Progress → Ready to Close → Closed) and the four core capabilities.
- **Login** — two-step, no typing required: pick your team (color-coded by
  system: FMCS blue, HVAC yellow, GAS-CHEM violet, UPW teal, ELECTRICAL red),
  then pick your name from that team's roster.
- **Tracker (full app)**
  - Create action items with title, description, owner, team, source
    (governance / audit / project / leadership review), and deadline.
  - Filter by status and owner.
  - Live status counts strip (Open / In Progress / Awaiting Verify / Closed
    / Overdue).
  - Stage-bar progress indicator per item, mirroring how a lot moves
    through the line.
  - Overdue items are flagged with a red border and tag.
  - Closure requires a **separate verifier name + evidence note** — no
    self-certified closures.

## What's next

- Automated email reminders for items due soon / overdue, with escalation
  over time.
- Dashboard view (aging buckets, average time-to-closure, overdue-by-owner).
- Real authentication (current login is a lightweight identity picker, not
  password-protected — fine for a trusted pilot, not for wider rollout).

---

## Tech stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS, IBM Plex Sans / IBM Plex Mono
- **Backend**: Supabase (Postgres + auto-generated REST API)
- No custom backend server — the frontend talks to Supabase directly.

---

## Project structure 

action-tracker/
├── schema.sql # Supabase table definition — run in SQL editor
├── src/
│ ├── App.jsx # Top-level router: landing / login / tracker
│ ├── supabaseClient.js # Supabase connection, reads from .env
│ ├── index.css # Tailwind entry point
│ └── components/
│ ├── Landing.jsx # Marketing/intro page
│ ├── Login.jsx # Team + name picker
│ └── Tracker.jsx # The actual action item tracker
├── .env.example # Template for your Supabase credentials
├── tailwind.config.js
└── vite.config.js

---

## Getting started

1. **Clone the repo**
```bash
   git clone https://github.com/iqbalkhan-kzanu/etch-trackeverything-.git
   cd etch-trackeverything-
```

2. **Create a free Supabase project** at [supabase.com](https://supabase.com)

3. **Run the schema** — open your Supabase project's SQL Editor, paste the
   contents of `schema.sql`, and run it. This creates the `action_items`
   table with Row Level Security enabled.

4. **Get your API keys** — Project Settings → API in Supabase. Copy the
   **Project URL** and the **Publishable key** (or legacy anon key).

5. **Set up environment variables**
```bash
   cp .env.example .env
```
   Then edit `.env` and paste in your own values:  

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here

6. **Install and run**
```bash
   npm install
   npm run dev
```
   Open the local URL Vite prints (usually `http://localhost:5173`).

---

## Contributing

This is a pilot project — pull requests welcome.

1. Fork the repo (or create a branch directly if you have write access)
2. `git checkout -b your-feature-name`
3. Make your changes, then:
```bash
   git add .
   git commit -m "Describe your change"
   git push origin your-feature-name
```
4. Open a Pull Request against `main` and describe what you changed and why

Please don't commit your own `.env` file — it's already excluded via
`.gitignore`, but double check before pushing.

---

## Team

Built for the New Joinee Pilot · 5 Teams · 34 Engineers · Tata Electronics,
Dholera Fab. 

Once it's saved, push it up:

git add README.md
git commit -m "Add project README"
git push  

 