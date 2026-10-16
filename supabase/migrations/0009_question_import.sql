-- P5 question bank: bulk import with de-duplication, and the per-admin AI rate limit (TRD › HTTP route).

-- One copy of each question (case-insensitive), whatever its source.
create unique index if not exists questions_text_unique on public.questions (lower(btrim(text)));

-- Saves reviewed drafts. Duplicates and rows that break the table's rules are counted, not fatal.
create or replace function public.import_questions(p_questions jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q jsonb;
  inserted int := 0;
  duplicates int := 0;
  invalid int := 0;
begin
  perform private.require_admin();
  if p_source not in ('manual', 'csv', 'ai') or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 500 then
    perform private.fail('VALIDATION');
  end if;

  for q in select * from jsonb_array_elements(p_questions) loop
    if exists (select 1 from public.questions where lower(btrim(text)) = lower(btrim(q ->> 'text'))) then
      duplicates := duplicates + 1;
      continue;
    end if;
    begin
      insert into public.questions (text, type, options, answer, alternatives, difficulty, topic, source)
      values (
        btrim(q ->> 'text'),
        q ->> 'type',
        case when q ->> 'type' = 'mcq' then q -> 'options' end,
        btrim(q ->> 'answer'),
        coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'alternatives', '[]'::jsonb))), '{}'),
        (q ->> 'difficulty')::int,
        coalesce(nullif(btrim(q ->> 'topic'), ''), 'general'),
        p_source
      );
      inserted := inserted + 1;
    exception
      when unique_violation then duplicates := duplicates + 1;
      when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range
        or invalid_parameter_value or data_exception then invalid := invalid + 1;
    end;
  end loop;

  perform private.audit('import_questions', p_source, format('%s inserted, %s duplicates, %s invalid', inserted, duplicates, invalid));
  return jsonb_build_object('inserted', inserted, 'duplicates', duplicates, 'invalid', invalid);
end;
$$;

-- 10 AI requests per admin per minute (cost control; SECURITY.md T12).
create or replace function public.log_ai_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_admin();
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_requests' || uid::text, 0));
  if (select count(*) from public.ai_requests where admin_id = uid and at > now() - interval '1 minute') >= 10 then
    perform private.fail('RATE_LIMITED');
  end if;
  insert into public.ai_requests (admin_id) values (uid);
end;
$$;

revoke all on function public.import_questions(jsonb, text) from public, anon;
grant execute on function public.import_questions(jsonb, text) to authenticated;
revoke all on function public.log_ai_request() from public, anon;
grant execute on function public.log_ai_request() to authenticated;
