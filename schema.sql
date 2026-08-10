-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_name text not null,
  team text,
  source text not null default 'other', -- governance | audit | project | leadership_review | other
  deadline date not null,
  status text not null default 'open',  -- open | in_progress | ready_to_close | closed
  closure_note text,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table action_items enable row level security;

create policy "Allow all access for pilot"
  on action_items
  for all
  using (true)
  with check (true);     