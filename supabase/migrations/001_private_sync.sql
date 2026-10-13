-- Apply once through the Supabase SQL editor or migration runner.
-- The browser receives only the public anon/publishable key.
create or replace function public.baga_valid_payload(k text, rid text, p jsonb)
returns boolean language plpgsql stable set search_path = pg_catalog, public as $$
declare field text; allowed text[]; t timestamptz;
begin
  if p is null or p = 'null'::jsonb then return true; end if;
  if jsonb_typeof(p->case when k = 'checkins' then 'date' else 'id' end) is distinct from 'string' then return false; end if;
  if jsonb_typeof(p) <> 'object' or octet_length(p::text) > 16000 then return false; end if;
  if k = 'checkins' then
    if p->>'date' is distinct from rid or rid !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    perform rid::date;
  elsif p->>'id' is distinct from rid then return false;
  end if;
  case k
    when 'logs' then
      allowed := array['id','variantId','brand','variant','quantity','smokedAt','priceSnapshot','trigger','mood','location','notes','revision','updatedAt','deletedAt'];
      foreach field in array array['variantId','brand','variant','smokedAt','trigger','mood','location','notes','updatedAt'] loop
        if jsonb_typeof(p->field) is distinct from 'string' then return false; end if;
      end loop;
      if length(p->>'brand') not between 1 and 80 or length(p->>'variantId') not between 1 and 120 or length(p->>'variant') > 80 or length(p->>'trigger') > 60 or length(p->>'mood') > 60 or length(p->>'location') > 60 or length(p->>'notes') > 1000 then return false; end if;
      if jsonb_typeof(p->'quantity') is distinct from 'number' or (p->>'quantity')::numeric not between 1 and 100 or (p->>'quantity')::numeric <> trunc((p->>'quantity')::numeric) then return false; end if;
      if jsonb_typeof(p->'priceSnapshot') is distinct from 'number' or (p->>'priceSnapshot')::numeric not between 0 and 10000 then return false; end if;
      if jsonb_typeof(p->'revision') is distinct from 'number' or (p->>'revision')::numeric < 1 or (p->>'revision')::numeric <> trunc((p->>'revision')::numeric) then return false; end if;
      t := (p->>'smokedAt')::timestamptz;
      if t > now() + interval '1 minute' then return false; end if;
      perform (p->>'updatedAt')::timestamptz;
      if not (p ? 'deletedAt') then return false; end if;
      if p->'deletedAt' <> 'null'::jsonb then perform (p->>'deletedAt')::timestamptz; end if;
    when 'preferences' then
      allowed := array['id','name','onboarded','adult','timezone','dailyLimit','baseline','weeklyReduction','goalMode','quitAt','favoriteId','price','packSize','priceUnit','animation','intensity','reminder','reminderTime','theme','showSpending','showLungs','customPricePrompt'];
      if rid <> 'local' then return false; end if;
      foreach field in array array['name','timezone','goalMode','quitAt','favoriteId','priceUnit','reminderTime','theme'] loop
        if jsonb_typeof(p->field) is distinct from 'string' then return false; end if;
      end loop;
      foreach field in array array['onboarded','adult','animation','reminder','showSpending','showLungs'] loop
        if jsonb_typeof(p->field) is distinct from 'boolean' then return false; end if;
      end loop;
      if p ? 'customPricePrompt' and jsonb_typeof(p->'customPricePrompt') is distinct from 'boolean' then return false; end if;
      foreach field in array array['dailyLimit','baseline','weeklyReduction','intensity','packSize','price'] loop
        if jsonb_typeof(p->field) is distinct from 'number' or (p->>field)::numeric < 0 then return false; end if;
      end loop;
      foreach field in array array['dailyLimit','baseline','packSize'] loop
        if (p->>field)::numeric <> trunc((p->>field)::numeric) then return false; end if;
      end loop;
      if (p->>'dailyLimit')::numeric > 100 or (p->>'baseline')::numeric > 100 or (p->>'weeklyReduction')::numeric > 100 or (p->>'intensity')::numeric > 100 or (p->>'price')::numeric > 10000 or (p->>'packSize')::numeric not between 1 and 100 then return false; end if;
      if length(p->>'name') > 40 or length(p->>'favoriteId') not between 1 and 120 or p->>'goalMode' not in ('reduce','quit','track') or p->>'priceUnit' not in ('stick','pack') or p->>'theme' not in ('dark','light') or p->>'reminderTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
      if not exists(select 1 from pg_timezone_names where name = p->>'timezone') then return false; end if;
      if p->>'quitAt' <> '' then perform (p->>'quitAt')::timestamptz; end if;
    when 'checkins' then
      allowed := array['date','completedAt','confirmedCount'];
      if jsonb_typeof(p->'completedAt') is distinct from 'string' or jsonb_typeof(p->'confirmedCount') is distinct from 'number' or (p->>'confirmedCount')::numeric not between 0 and 10000 or (p->>'confirmedCount')::numeric <> trunc((p->>'confirmedCount')::numeric) then return false; end if;
      perform (p->>'completedAt')::timestamptz;
    when 'measurements' then
      allowed := array['id','type','value','reference','unit','source','measuredAt'];
      if jsonb_typeof(p->'type') is distinct from 'string' or jsonb_typeof(p->'unit') is distinct from 'string' or p->>'type' not in ('Volume','FVC','FEV1') or p->>'unit' <> 'L' or jsonb_typeof(p->'source') is distinct from 'string' or length(p->>'source') not between 1 and 100 then return false; end if;
      foreach field in array array['value','reference'] loop
        if jsonb_typeof(p->field) is distinct from 'number' or (p->>field)::numeric <= 0 or (p->>field)::numeric > 10 then return false; end if;
      end loop;
      if jsonb_typeof(p->'measuredAt') is distinct from 'string' then return false; end if;
      t := (p->>'measuredAt')::timestamptz;
      if t > now() then return false; end if;
    when 'variants' then
      allowed := array['id','brand','name','custom'];
      if jsonb_typeof(p->'brand') is distinct from 'string' or length(p->>'brand') not between 1 and 80 or jsonb_typeof(p->'name') is distinct from 'string' or length(p->>'name') > 80 then return false; end if;
      if p ? 'custom' and jsonb_typeof(p->'custom') <> 'boolean' then return false; end if;
    when 'cravings' then
      allowed := array['id','at','intensity','trigger','notes','coping','outcome'];
      if jsonb_typeof(p->'at') is distinct from 'string' or jsonb_typeof(p->'intensity') is distinct from 'number' or (p->>'intensity')::numeric not between 1 and 5 or (p->>'intensity')::numeric <> trunc((p->>'intensity')::numeric) then return false; end if;
      perform (p->>'at')::timestamptz;
      if jsonb_typeof(p->'trigger') is distinct from 'string' or length(p->>'trigger') > 60 or jsonb_typeof(p->'notes') is distinct from 'string' or length(p->>'notes') > 1000 then return false; end if;
      if p ? 'coping' and (jsonb_typeof(p->'coping') <> 'string' or length(p->>'coping') > 100) then return false; end if;
      if p ? 'outcome' and p->>'outcome' not in ('passed','smoked','ongoing') then return false; end if;
    else return false;
  end case;
  foreach field in array allowed loop
    if field not in ('custom','coping','outcome','customPricePrompt') and not (p ? field) then return false; end if;
  end loop;
  if p ? 'outcome' and jsonb_typeof(p->'outcome') <> 'string' then return false; end if;
  foreach field in array array['smokedAt','updatedAt','deletedAt','completedAt','measuredAt','at'] loop
    if p ? field and p->field <> 'null'::jsonb then
      if jsonb_typeof(p->field) <> 'string' or p->>field !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' then return false; end if;
    end if;
  end loop;
  return (p - allowed) = '{}'::jsonb;
exception when others then return false;
end;
$$;

create table public.baga_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('logs','preferences','checkins','measurements','variants','cravings')),
  record_id text not null check (length(record_id) between 1 and 120),
  payload jsonb,
  revision integer not null check (revision > 0),
  primary key (user_id,key),
  check (key = kind || ':' || record_id),
  check (public.baga_valid_payload(kind, record_id, payload))
);
alter table public.baga_records enable row level security;
create policy own_records on public.baga_records for select to authenticated using (user_id = auth.uid());
revoke all on public.baga_records from anon, authenticated;
grant select on public.baga_records to authenticated;

-- Receipts make retries safe even when the first response is lost.
create table public.baga_sync_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id)
);
alter table public.baga_sync_receipts enable row level security;
revoke all on public.baga_sync_receipts from anon, authenticated;
create index baga_receipt_rate on public.baga_sync_receipts(user_id,created_at);

create or replace function public.baga_sync_batch(p_operations jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  uid uuid := auth.uid(); op jsonb; saved jsonb; receipt_request jsonb;
  current_row public.baga_records%rowtype; response jsonb; results jsonb := '[]'::jsonb;
  oid uuid; expected integer; recent_count integer;
begin
  if uid is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) > 50 or octet_length(p_operations::text) > 524288 then raise exception 'invalid_batch' using errcode = '22023'; end if;
  -- All operations for an account are serialized, including concurrent devices.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select count(*) into recent_count from public.baga_sync_receipts where user_id=uid and created_at>now()-interval '1 minute';
  for op in select value from jsonb_array_elements(p_operations) loop
    if jsonb_typeof(op) <> 'object' or not(op ?& array['operation_id','key','kind','record_id','payload','expected_revision']) or (op - array['operation_id','key','kind','record_id','payload','expected_revision']) <> '{}'::jsonb then raise exception 'invalid_operation' using errcode = '22023'; end if;
    oid := (op->>'operation_id')::uuid;
    expected := (op->>'expected_revision')::integer;
    if expected < 0 or jsonb_typeof(op->'expected_revision') <> 'number' or (op->>'expected_revision')::numeric <> expected then raise exception 'invalid_revision' using errcode = '22023'; end if;
    select request,result into receipt_request,saved from public.baga_sync_receipts where user_id = uid and operation_id = oid;
    if found then
      if receipt_request <> op then raise exception 'idempotency_key_reused' using errcode = '22023'; end if;
      results := results || jsonb_build_array(saved); continue;
    end if;
    if recent_count >= 2000 then raise exception 'rate_limit_exceeded' using errcode='P0001'; end if;
    recent_count := recent_count + 1;
    if op->>'kind' not in ('logs','preferences','checkins','measurements','variants','cravings') or length(op->>'record_id') not between 1 and 120 or op->>'key' is distinct from (op->>'kind') || ':' || (op->>'record_id') or not public.baga_valid_payload(op->>'kind',op->>'record_id',op->'payload') then raise exception 'invalid_payload' using errcode = '22023'; end if;
    select * into current_row from public.baga_records where user_id = uid and key = op->>'key';
    if coalesce(current_row.revision,0) <> expected then
      response := jsonb_build_object('operation_id',oid,'status','conflict','row',to_jsonb(current_row)-'user_id');
    else
      insert into public.baga_records(user_id,key,kind,record_id,payload,revision)
      values(uid,op->>'key',op->>'kind',op->>'record_id',nullif(op->'payload','null'::jsonb),expected+1)
      on conflict(user_id,key) do update set payload = excluded.payload, revision = excluded.revision
      returning * into current_row;
      response := jsonb_build_object('operation_id',oid,'status','applied','row',to_jsonb(current_row)-'user_id');
    end if;
    insert into public.baga_sync_receipts(user_id,operation_id,request,result) values(uid,oid,op,response);
    results := results || jsonb_build_array(response);
  end loop;
  return results;
end;
$$;
revoke all on function public.baga_sync_batch(jsonb) from public, anon;
grant execute on function public.baga_sync_batch(jsonb) to authenticated;

create or replace function public.baga_delete_account()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  -- Cascading deletion removes records, receipts, and the Supabase auth identity.
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.baga_delete_account() from public, anon;
grant execute on function public.baga_delete_account() to authenticated;
