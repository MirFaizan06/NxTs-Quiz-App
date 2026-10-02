# NxT Quiz

Live quizzes across science, mathematics, geography, general knowledge, programming, and more. A teacher opens a room, students type a code on their phones, and everyone races through questions while a leaderboard reshuffles in real time.

It started as a weekend answer to a simple annoyance: the popular quiz tools are great for trivia and awkward for code. Snippets get mangled, there is no easy way to generate a question set about, say, C++ constructors, and the good features sit behind a subscription. NxT Quiz runs on free tiers and stays out of the way.

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Realtime-3ecf8e) ![stack](https://img.shields.io/badge/Groq-GPT--OSS--20B-f55036) ![stack](https://img.shields.io/badge/TypeScript-strict-3178c6)

## What a round looks like

1. The host builds a quiz from the question bank and gets a room code.
2. Students sign in, enter the code and land in a lobby that fills up as people arrive.
3. The host starts the quiz. Each question has its own timer and the whole room sees it at once.
4. Correct answers earn more points the faster they come in. Rankings update the moment an answer is locked.
5. The host moves through the questions and the quiz ends on a podium and a final leaderboard.

Questions can be single choice, multiple choice or true/false. The admin side has a Groq-powered generator that drafts questions for a selected category and focus area. Quiz creation can filter the bank to one category, such as Zoology or Geography. Treat generated output as a first draft and review it before a live round.

## How it works

**Answers never reach the browser early.** The endpoint that serves the current question selects the text, options, points and time limit and nothing else. Grading happens inside a Postgres function (`submit_answer`) that runs with the caller's identity, checks the quiz is live, rejects late and duplicate submissions, and writes the score in the same transaction.

**Scoring is linear in time.** A correct answer is worth the question's full points when it lands instantly and falls to 20% as the timer runs out, with a floor of 20 points. A short grace window covers network latency.

**Realtime without a socket server.** The play, lobby and host screens subscribe to row changes on `quizzes` and `participants` through Supabase Realtime. The host advances the quiz by updating a row, and every client reacts to it.

**Row-level security does the boring work.** Players can only read quizzes they belong to, hosts can only update their own quizzes, and display names are readable only by people in the same room.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling and motion | Tailwind CSS 4, a hand-written design system, Framer Motion, canvas particles and confetti |
| Auth, data, realtime | Supabase (Auth, Postgres, Realtime, RLS) |
| Question generation | Groq (`llama-3.3-70b-versatile`) |
| Validation | Zod |
| Hosting | Vercel |

## Project layout

```
src/
  app/
    page.tsx              landing page
    login/  join/         auth and room entry
    quiz/[id]/            the player experience: lobby, live question, podium
    admin/                dashboard, question bank, host controls
    api/                  route handlers (join, start, next, answer, generate...)
  components/             navbar, particles, confetti, landing visuals
  lib/                    Supabase clients, auth guards, realtime players hook
supabase/schema.sql       tables, RLS policies, topic catalog, scoring function
supabase/migrations/      migrations for existing Supabase projects
```

## Running it

Setup instructions live in `SETUP.md`, which is kept out of version control on purpose because it is full of project-specific notes. The short version: create a Supabase project, run `supabase/schema.sql`, copy `.env.example` to `.env.local`, and start the dev server. Existing databases should also run `supabase/migrations/202610020001_expand_topics.sql` in the Supabase SQL Editor to add the broader topic catalog.

```bash
npm install
npm run dev
```

## Roadmap

Things I would build next, roughly in order:

- Editing questions in the UI instead of delete-and-recreate
- CSV import and export for question banks
- Image and code-block questions
- Rate limiting on the join and answer endpoints
- Reconnect handling for students whose phones sleep mid-round
- Tab-switch detection for exam-style rounds
- Automated tests around scoring and the host controls

## Limits worth knowing

Free tiers have quotas. A large room, heavy Groq usage or a busy Realtime channel can run into them. There is no moderation layer, so treat accounts as classroom-grade rather than public-internet-grade until rate limiting lands.
