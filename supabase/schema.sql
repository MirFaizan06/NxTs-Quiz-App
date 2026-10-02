create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('student','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quiz_status as enum ('lobby','live','finished');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum ('single','multiple','boolean');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Student',
  username text unique,
  avatar_url text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete set null,
  question_text text not null,
  question_type public.question_type not null default 'single',
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null,
  explanation text,
  difficulty text not null default 'medium',
  points integer not null default 100 check (points > 0),
  time_limit integer not null default 20 check (time_limit between 5 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  room_code text not null unique,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status public.quiz_status not null default 'lobby',
  current_question integer not null default 0,
  question_started_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position integer not null,
  primary key (quiz_id, question_id),
  unique (quiz_id, position)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0,
  correct_answers integer not null default 0,
  total_answers integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer jsonb not null,
  is_correct boolean not null,
  response_time_ms integer not null,
  points integer not null default 0,
  submitted_at timestamptz not null default now(),
  unique (quiz_id, question_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
      'Student'
    ),
    nullif(new.raw_user_meta_data->>'username','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists questions_updated_at on public.questions;
create trigger questions_updated_at before update on public.questions for each row execute procedure public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.is_quiz_member(p_quiz_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.participants where quiz_id=p_quiz_id and user_id=auth.uid())
      or exists(select 1 from public.quizzes where id=p_quiz_id and host_id=auth.uid());
$$;

create or replace function public.submit_answer(p_quiz_id uuid, p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q public.quizzes;
  qq public.quiz_questions;
  question public.questions;
  elapsed integer;
  correct boolean := false;
  awarded integer := 0;
  existing boolean;
  normalized_user jsonb;
  normalized_correct jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into q from public.quizzes where id=p_quiz_id;
  if q.id is null or q.status <> 'live' then raise exception 'Quiz is not live'; end if;
  if not exists(select 1 from public.participants where quiz_id=p_quiz_id and user_id=auth.uid()) then raise exception 'Join the quiz first'; end if;
  select * into qq from public.quiz_questions where quiz_id=p_quiz_id and position=q.current_question;
  if qq.question_id is null then raise exception 'No active question'; end if;
  select * into question from public.questions where id=qq.question_id;
  elapsed := greatest(0, floor(extract(epoch from (now() - coalesce(q.question_started_at, now()))) * 1000));
  if elapsed > question.time_limit * 1000 + 1500 then raise exception 'Time expired'; end if;
  select exists(select 1 from public.answers where quiz_id=p_quiz_id and question_id=question.id and user_id=auth.uid()) into existing;
  if existing then raise exception 'Already answered'; end if;

  if question.question_type = 'multiple' then
    select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into normalized_user from jsonb_array_elements_text(p_answer) x(value);
    select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into normalized_correct from jsonb_array_elements_text(question.correct_answer) x(value);
    correct := normalized_user = normalized_correct;
  else
    correct := p_answer = question.correct_answer;
  end if;

  if correct then
    awarded := greatest(20, round(question.points * (1.0 - least(elapsed::numeric / greatest(question.time_limit*1000,1), 1) * 0.8))::integer);
  end if;

  insert into public.answers(quiz_id,question_id,user_id,answer,is_correct,response_time_ms,points)
  values(p_quiz_id,question.id,auth.uid(),p_answer,correct,elapsed,awarded);

  update public.participants
  set score=score+awarded, correct_answers=correct_answers+(case when correct then 1 else 0 end), total_answers=total_answers+1
  where quiz_id=p_quiz_id and user_id=auth.uid();

  return jsonb_build_object('correct',correct,'points',awarded,'response_time_ms',elapsed);
end;
$$;

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id=auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists profiles_select_quiz_members on public.profiles;
create policy profiles_select_quiz_members on public.profiles for select using (exists(select 1 from public.participants p where p.user_id=profiles.id and public.is_quiz_member(p.quiz_id)));

drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics for select using (true);

drop policy if exists quizzes_select_member on public.quizzes;
create policy quizzes_select_member on public.quizzes for select using (public.is_quiz_member(id));
drop policy if exists quizzes_insert_host on public.quizzes;
create policy quizzes_insert_host on public.quizzes for insert with check (host_id=auth.uid());
drop policy if exists quizzes_update_host on public.quizzes;
create policy quizzes_update_host on public.quizzes for update using (host_id=auth.uid()) with check (host_id=auth.uid());

drop policy if exists quiz_questions_member on public.quiz_questions;
create policy quiz_questions_member on public.quiz_questions for select using (public.is_quiz_member(quiz_id));

drop policy if exists participants_select_member on public.participants;
create policy participants_select_member on public.participants for select using (public.is_quiz_member(quiz_id));
drop policy if exists participants_insert_self on public.participants;
create policy participants_insert_self on public.participants for insert with check (user_id=auth.uid());

drop policy if exists answers_select_self on public.answers;
create policy answers_select_self on public.answers for select using (user_id=auth.uid());

grant execute on function public.submit_answer(uuid,jsonb) to authenticated;
grant execute on function public.is_quiz_member(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.quizzes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null; end $$;

insert into public.topics(name, description)
select seed.name, seed.description
from (values
  ('Programming', 'Programming languages, algorithms, and software development'),
  ('Computer Science', 'Databases, operating systems, networking, and computing theory'),
  ('Mathematics', 'Algebra, calculus, geometry, probability, and statistics'),
  ('Physics', 'Mechanics, energy, electromagnetism, and modern physics'),
  ('Chemistry', 'Matter, reactions, elements, and chemical principles'),
  ('Biology', 'Life sciences, cells, genetics, and organisms'),
  ('Zoology', 'Animal biology, anatomy, behavior, and classification'),
  ('Botany', 'Plant biology, anatomy, physiology, and classification'),
  ('Geography', 'Physical geography, countries, maps, climate, and places'),
  ('General Knowledge', 'Cross-disciplinary facts, culture, and current affairs'),
  ('Astronomy', 'Space, planets, stars, and the universe'),
  ('Environmental Science', 'Ecosystems, conservation, climate, and sustainability'),
  ('Education', 'Teaching, learning, educational systems, and assessment'),
  ('Sociology', 'Society, social behavior, institutions, and social change'),
  ('Economics', 'Markets, resources, production, trade, and economic systems'),
  ('Philosophy', 'Ethics, logic, knowledge, and philosophical traditions'),
  ('Psychology', 'Cognition, emotion, behavior, and mental processes')
) as seed(name, description)
where not exists (
  select 1 from public.topics existing
  where lower(trim(existing.name)) = lower(trim(seed.name))
);
