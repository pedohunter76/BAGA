create table public.baga_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) <= 2048),
  subscription jsonb not null check (octet_length(subscription::text) <= 4096),
  category text not null check (category in ('daily','weekly')),
  timezone text not null,
  reminder_time text not null check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_start text not null,
  quiet_end text not null,
  next_at timestamptz not null,
  lease_until timestamptz,
  retries integer not null default 0,
  unique(user_id,endpoint,category)
);
alter table public.baga_push_subscriptions enable row level security;
create policy own_reminders on public.baga_push_subscriptions for select to authenticated using (user_id = auth.uid());
revoke all on public.baga_push_subscriptions from anon,authenticated;
grant select on public.baga_push_subscriptions to authenticated;
grant all on public.baga_push_subscriptions to service_role;
create index baga_push_due on public.baga_push_subscriptions(next_at,lease_until);

create or replace function public.baga_claim_reminders()
returns setof public.baga_push_subscriptions language sql security definer set search_path = pg_catalog, public as $$
  with due as (
    select id from public.baga_push_subscriptions
    where next_at <= now() and (lease_until is null or lease_until < now())
    order by next_at limit 100 for update skip locked
  )
  update public.baga_push_subscriptions as s set lease_until = now() + interval '5 minutes', retries = s.retries+1
  from due where s.id = due.id returning s.*;
$$;
revoke all on function public.baga_claim_reminders() from public,anon,authenticated;
grant execute on function public.baga_claim_reminders() to service_role;
