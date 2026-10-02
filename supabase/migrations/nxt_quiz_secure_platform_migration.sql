-- Secure platform feature migration for the original NxT Quiz schema.
-- Run AFTER the original schema migration.
-- This migration is intentionally additive/non-destructive.

begin;

-- ============================================================
-- 1. Quiz/public-lobby fields
-- ============================================================

alter table public.quizzes
  add column if not exists description text,
  add column if not exists topic_id uuid references public.topics(id) on delete set null,
  add column if not exists is_public boolean not null default false,
  add column if not exists max_players integer,
  add column if not exists allow_rejoin boolean not null default true;

alter table public.quizzes
  drop constraint if exists quizzes_max_players_check;

alter table public.quizzes
  add constraint quizzes_max_players_check
  check (max_players is null or max_players between 1 and 100000);

create index if not exists quizzes_public_lobby_idx
  on public.quizzes (is_public, status, created_at desc);

create index if not exists quizzes_topic_idx
  on public.quizzes(topic_id);

-- ============================================================
-- 2. Participant presence / reconnect telemetry
-- ============================================================

alter table public.participants
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists reconnect_count integer not null default 0,
  add column if not exists tab_switch_count integer not null default 0;

alter table public.participants
  drop constraint if exists participants_reconnect_count_check;

alter table public.participants
  add constraint participants_reconnect_count_check
  check (reconnect_count >= 0);

alter table public.participants
  drop constraint if exists participants_tab_switch_count_check;

alter table public.participants
  add constraint participants_tab_switch_count_check
  check (tab_switch_count >= 0);

-- ============================================================
-- 3. Event telemetry
-- ============================================================

create table if not exists public.quiz_events (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (
    event_type in ('tab_hidden','tab_visible','reconnect','heartbeat')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quiz_events_lookup_idx
  on public.quiz_events(quiz_id, user_id, created_at desc);

-- ============================================================
-- 4. Rate-limit storage
-- ============================================================

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events(bucket, subject, created_at desc);

-- ============================================================
-- 5. Static admin monetization configuration
-- ============================================================

create table if not exists public.monetization_plan_settings (
  id boolean primary key default true check (id),
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. RLS on all newly-created tables
-- ============================================================

alter table public.quiz_events enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.monetization_plan_settings enable row level security;

-- Remove any previous permissive policies on these tables.
drop policy if exists quiz_events_select_admin on public.quiz_events;
drop policy if exists quiz_events_select_self_or_admin on public.quiz_events;
drop policy if exists quiz_events_insert_self on public.quiz_events;

drop policy if exists monetization_admin_read on public.monetization_plan_settings;

-- Event records may be read by the owner or an administrator.
-- There is deliberately NO client INSERT policy.
-- Client events are written only through SECURITY DEFINER RPCs below.
create policy quiz_events_select_self_or_admin
on public.quiz_events
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- Static plan configuration is admin-readable only.
create policy monetization_admin_read
on public.monetization_plan_settings
for select
to authenticated
using (public.is_admin());

-- No policies are created for rate_limit_events.
-- It is an internal implementation table.

revoke all on public.quiz_events from anon, authenticated;
grant select on public.quiz_events to authenticated;

revoke all on public.rate_limit_events from anon, authenticated;

revoke all on public.monetization_plan_settings from anon, authenticated;
grant select on public.monetization_plan_settings to authenticated;

-- ============================================================
-- 7. Fix the original profile security hole
-- ============================================================

-- The original schema allowed a user to update their own entire
-- profile row, including role. That could allow self-promotion
-- from student -> admin.
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

-- Column-level UPDATE permission: normal users can edit only
-- profile presentation fields. "role" is intentionally excluded.
revoke update on public.profiles from authenticated;

grant update (name, username, avatar_url)
on public.profiles
to authenticated;

create policy profiles_update_self_safe
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Admins get their role-management capability through the
-- controlled RPC below rather than arbitrary profile updates.

-- ============================================================
-- 8. Controlled admin role-management RPC
-- ============================================================

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    -- Prevent an administrator from accidentally removing their
    -- own last administrative access.
    if not exists (
      select 1
      from public.profiles
      where role = 'admin'
        and id <> auth.uid()
    ) then
      raise exception 'Cannot remove the last administrator';
    end if;
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'role', p_role::text
  );
end;
$$;

revoke all on function public.set_user_role(uuid, public.user_role)
from public, anon, authenticated;

grant execute on function public.set_user_role(uuid, public.user_role)
to authenticated;

-- ============================================================
-- 9. Race-safe rate limiter
-- ============================================================

create or replace function public.rate_limit(
  p_bucket text,
  p_subject text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz;
  current_count integer;
  lock_key bigint;
begin
  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'Invalid rate-limit bucket';
  end if;

  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'Invalid rate-limit subject';
  end if;

  if p_window_seconds <= 0 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  if p_max <= 0 or p_max > 100000 then
    raise exception 'Invalid rate-limit maximum';
  end if;

  -- Serialize requests for the same bucket+subject.
  -- This closes the SELECT-count -> INSERT race from the previous
  -- migration.
  lock_key := hashtextextended(
    p_bucket || ':' || p_subject,
    0
  );

  perform pg_advisory_xact_lock(lock_key);

  cutoff := now() - make_interval(secs => p_window_seconds);

  -- Keep the internal table bounded.
  delete from public.rate_limit_events
  where created_at < now() - interval '1 hour';

  select count(*)
  into current_count
  from public.rate_limit_events
  where bucket = p_bucket
    and subject = p_subject
    and created_at >= cutoff;

  if current_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_events(bucket, subject)
  values (p_bucket, p_subject);

  return true;
end;
$$;

revoke all on function public.rate_limit(text,text,integer,integer)
from public, anon, authenticated;

-- SECURITY DEFINER submit_answer calls this internally.
-- No direct client execution is granted.
-- The function owner must have permission to execute it.

-- ============================================================
-- 10. Secure participant event RPCs
-- ============================================================

create or replace function public.touch_participant(
  p_quiz_id uuid,
  p_event_type text default 'reconnect'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_event_type not in ('reconnect', 'heartbeat') then
    raise exception 'Invalid event type';
  end if;

  update public.participants
  set last_seen_at = now(),
      reconnect_count = reconnect_count
        + case when p_event_type = 'reconnect' then 1 else 0 end
  where quiz_id = p_quiz_id
    and user_id = auth.uid()
  returning id into participant_id;

  if participant_id is null then
    raise exception 'Join the quiz first';
  end if;

  insert into public.quiz_events(
    quiz_id,
    user_id,
    event_type
  )
  values (
    p_quiz_id,
    auth.uid(),
    p_event_type
  );

  return jsonb_build_object(
    'ok', true,
    'last_seen_at', now()
  );
end;
$$;

create or replace function public.record_quiz_event(
  p_quiz_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_event_type not in (
    'tab_hidden',
    'tab_visible',
    'reconnect',
    'heartbeat'
  ) then
    raise exception 'Invalid event';
  end if;

  -- Do not allow arbitrarily huge metadata payloads.
  if pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 16384 then
    raise exception 'Event metadata too large';
  end if;

  update public.participants
  set last_seen_at = now(),
      tab_switch_count = tab_switch_count
        + case when p_event_type = 'tab_hidden' then 1 else 0 end,
      reconnect_count = reconnect_count
        + case when p_event_type = 'reconnect' then 1 else 0 end
  where quiz_id = p_quiz_id
    and user_id = auth.uid()
  returning id into participant_id;

  if participant_id is null then
    raise exception 'Join the quiz first';
  end if;

  insert into public.quiz_events(
    quiz_id,
    user_id,
    event_type,
    metadata
  )
  values (
    p_quiz_id,
    auth.uid(),
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.touch_participant(uuid,text)
from public, anon, authenticated;

revoke all on function public.record_quiz_event(uuid,text,jsonb)
from public, anon, authenticated;

grant execute on function public.touch_participant(uuid,text)
to authenticated;

grant execute on function public.record_quiz_event(uuid,text,jsonb)
to authenticated;

-- ============================================================
-- 11. Replace submit_answer with concurrency-safe enforcement
-- ============================================================

create or replace function public.submit_answer(
  p_quiz_id uuid,
  p_answer jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  qq public.quiz_questions;
  question public.questions;
  elapsed integer;
  correct boolean := false;
  awarded integer := 0;
  inserted_answer_id uuid;
  normalized_user jsonb;
  normalized_correct jsonb;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  -- 20 attempts per user/quiz in a rolling 10-second window.
  if not public.rate_limit(
    'answer',
    auth.uid()::text || ':' || p_quiz_id::text,
    10,
    20
  ) then
    raise exception 'Too many answer attempts. Please slow down.';
  end if;

  select *
  into q
  from public.quizzes
  where id = p_quiz_id;

  if q.id is null or q.status <> 'live' then
    raise exception 'Quiz is not live';
  end if;

  if not exists (
    select 1
    from public.participants
    where quiz_id = p_quiz_id
      and user_id = auth.uid()
  ) then
    raise exception 'Join the quiz first';
  end if;

  select *
  into qq
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and position = q.current_question;

  if qq.question_id is null then
    raise exception 'No active question';
  end if;

  select *
  into question
  from public.questions
  where id = qq.question_id;

  if question.id is null then
    raise exception 'Question not found';
  end if;

  elapsed := greatest(
    0,
    floor(
      extract(
        epoch from (
          now() - coalesce(q.question_started_at, now())
        )
      ) * 1000
    )
  );

  if elapsed > question.time_limit * 1000 + 1500 then
    raise exception 'Time expired';
  end if;

  -- Validate answer shape before comparing it.
  if question.question_type = 'multiple' then
    if jsonb_typeof(p_answer) <> 'array'
       or jsonb_typeof(question.correct_answer) <> 'array' then
      raise exception 'Invalid answer format';
    end if;

    select coalesce(
      jsonb_agg(value order by value),
      '[]'::jsonb
    )
    into normalized_user
    from jsonb_array_elements_text(p_answer) x(value);

    select coalesce(
      jsonb_agg(value order by value),
      '[]'::jsonb
    )
    into normalized_correct
    from jsonb_array_elements_text(question.correct_answer) x(value);

    correct := normalized_user = normalized_correct;
  else
    correct := p_answer = question.correct_answer;
  end if;

  if correct then
    awarded := greatest(
      20,
      round(
        question.points * (
          1.0
          - least(
              elapsed::numeric
              / greatest(question.time_limit * 1000, 1),
              1
            ) * 0.8
        )
      )::integer
    );
  end if;

  -- The original schema already has UNIQUE
  -- (quiz_id, question_id, user_id).
  -- Use that constraint as the concurrency-safe single-answer gate.
  insert into public.answers(
    quiz_id,
    question_id,
    user_id,
    answer,
    is_correct,
    response_time_ms,
    points
  )
  values (
    p_quiz_id,
    question.id,
    auth.uid(),
    p_answer,
    correct,
    elapsed,
    awarded
  )
  on conflict (quiz_id, question_id, user_id) do nothing
  returning id into inserted_answer_id;

  if inserted_answer_id is null then
    raise exception 'Already answered';
  end if;

  update public.participants
  set score = score + awarded,
      correct_answers = correct_answers
        + case when correct then 1 else 0 end,
      total_answers = total_answers + 1,
      last_seen_at = now()
  where quiz_id = p_quiz_id
    and user_id = auth.uid();

  return jsonb_build_object(
    'correct', correct,
    'points', awarded,
    'response_time_ms', elapsed
  );
end;
$$;

revoke all on function public.submit_answer(uuid,jsonb)
from public, anon, authenticated;

grant execute on function public.submit_answer(uuid,jsonb)
to authenticated;

-- ============================================================
-- 12. Public lobby discovery
-- ============================================================

drop policy if exists quizzes_public_select on public.quizzes;

create policy quizzes_public_select
on public.quizzes
for select
to anon, authenticated
using (
  is_public = true
  or public.is_quiz_member(id)
);

create or replace function public.list_public_lobbies()
returns table(
  id uuid,
  title text,
  description text,
  room_code text,
  topic_id uuid,
  topic_name text,
  topic_description text,
  participant_count bigint,
  max_players integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.title,
    q.description,
    q.room_code,
    q.topic_id,
    t.name,
    t.description,
    (
      select count(*)
      from public.participants p
      where p.quiz_id = q.id
    ),
    q.max_players,
    q.created_at
  from public.quizzes q
  left join public.topics t
    on t.id = q.topic_id
  where q.is_public = true
    and q.status = 'lobby'
  order by q.created_at desc;
$$;

revoke all on function public.list_public_lobbies()
from public, anon, authenticated;

grant execute on function public.list_public_lobbies()
to anon, authenticated;

-- ============================================================
-- 13. Student dashboard
-- ============================================================

create or replace function public.get_student_dashboard()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with mine as (
    select
      p.*,
      q.title,
      q.status,
      q.created_at,
      q.ended_at,
      q.topic_id,
      t.name as topic_name,
      (
        select count(*)
        from public.participants p2
        where p2.quiz_id = p.quiz_id
          and (
            p2.score > p.score
            or (
              p2.score = p.score
              and p2.correct_answers > p.correct_answers
            )
          )
      ) as better_count
    from public.participants p
    join public.quizzes q
      on q.id = p.quiz_id
    left join public.topics t
      on t.id = q.topic_id
    where p.user_id = auth.uid()
  )
  select jsonb_build_object(
    'summary',
    jsonb_build_object(
      'joined', count(*),
      'finished',
        count(*) filter (where status = 'finished'),
      'wins',
        count(*) filter (
          where status = 'finished'
            and better_count = 0
        ),
      'average_score',
        coalesce(round(avg(score))::integer, 0),
      'average_accuracy',
        coalesce(
          round(
            avg(
              case
                when total_answers > 0
                then correct_answers::numeric
                     / total_answers * 100
                else 0
              end
            )
          )::integer,
          0
        ),
      'total_points',
        coalesce(sum(score), 0),
      'correct_answers',
        coalesce(sum(correct_answers), 0),
      'answers',
        coalesce(sum(total_answers), 0)
    ),
    'quizzes',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(m)
            order by m.created_at desc
          )
          from mine m
        ),
        '[]'::jsonb
      )
  )
  from mine;
$$;

revoke all on function public.get_student_dashboard()
from public, anon, authenticated;

grant execute on function public.get_student_dashboard()
to authenticated;

-- ============================================================
-- 14. Seed/update static monetization configuration
-- ============================================================

insert into public.monetization_plan_settings(id, plan)
values (
  true,
  jsonb_build_object(
    'currency', 'INR',
    'model', 'freemium',
    'plans', jsonb_build_array(
      jsonb_build_object(
        'name', 'Free',
        'price_monthly', 0,
        'audience',
          'Students, individual teachers and small study groups',
        'limits',
          '10 public quizzes/month, 100 questions in bank, basic analytics'
      ),
      jsonb_build_object(
        'name', 'Teacher Plus',
        'price_monthly', 149,
        'price_annual', 1490,
        'audience', 'Individual teachers',
        'limits',
          'Unlimited private quizzes, 1,000 question bank, CSV tools, advanced analytics, custom branding'
      ),
      jsonb_build_object(
        'name', 'Campus',
        'price_monthly', 799,
        'price_annual', 7990,
        'audience', 'Departments and small institutions',
        'limits',
          'Multiple admins, shared question bank, public lobby management, institution analytics, priority support'
      )
    ),
    'payment_gateway', 'Razorpay',
    'gateway_note',
      'Budget for roughly 2% + applicable GST on standard domestic transactions; verify the live merchant agreement before launch.',
    'strategy',
      'Keep student access free. Charge for teacher/admin productivity and institutional controls. Do not put live quiz participation behind a paywall.',
    'launch',
      'Start with Free + Teacher Plus. Add Campus only after repeated institutional demand.'
  )
)
on conflict (id) do update
set plan = excluded.plan,
    updated_at = now();

-- ============================================================
-- 15. Realtime additions
-- ============================================================

do $$
begin
  begin
    alter publication supabase_realtime
      add table public.quizzes;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime
      add table public.participants;
  exception
    when duplicate_object then null;
  end;
end;
$$;

commit;
