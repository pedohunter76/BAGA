-- Backward-compatible preferences extension. Existing sync kinds and conflict review remain unchanged.
alter function public.baga_valid_payload(text,text,jsonb) rename to baga_valid_payload_v1;
create function public.baga_valid_payload(k text, rid text, p jsonb)
returns boolean language plpgsql stable set search_path = pg_catalog, public as $$
declare goal jsonb; previous_date text := ''; field text; numeric_value numeric;
begin
  if k <> 'preferences' or p is null or p = 'null'::jsonb or not (p ? 'goalHistory') then
    return public.baga_valid_payload_v1(k,rid,p);
  end if;
  if octet_length(p::text) > 256000 or jsonb_typeof(p->'goalHistory') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p->'goalHistory') > 1000 then return false; end if;
  if not public.baga_valid_payload_v1(k,rid,p - 'goalHistory') then return false; end if;
  for goal in select value from jsonb_array_elements(p->'goalHistory') loop
    if jsonb_typeof(goal) is distinct from 'object' or (goal - array['effectiveDate','timezone','goalMode','dailyLimit','baseline','weeklyReduction','quitAt']) <> '{}'::jsonb then return false; end if;
    foreach field in array array['effectiveDate','timezone','goalMode','quitAt'] loop
      if jsonb_typeof(goal->field) is distinct from 'string' then return false; end if;
    end loop;
    if goal->>'effectiveDate' !~ '^\d{4}-\d{2}-\d{2}$' or goal->>'effectiveDate' <= previous_date then return false; end if;
    perform (goal->>'effectiveDate')::date;
    previous_date := goal->>'effectiveDate';
    if not exists(select 1 from pg_timezone_names where name = goal->>'timezone') then return false; end if;
    if goal->>'goalMode' not in ('reduce','quit','track') then return false; end if;
    foreach field in array array['dailyLimit','baseline','weeklyReduction'] loop
      if jsonb_typeof(goal->field) is distinct from 'number' then return false; end if;
      numeric_value := (goal->>field)::numeric;
      if numeric_value not between 0 and 100 or (field <> 'weeklyReduction' and numeric_value <> trunc(numeric_value)) then return false; end if;
    end loop;
    if goal->>'quitAt' <> '' then perform (goal->>'quitAt')::timestamptz; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
