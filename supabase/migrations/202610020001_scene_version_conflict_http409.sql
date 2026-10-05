begin;

-- Application version mismatches cannot succeed by repeating the same SQL
-- transaction. Custom 40001 triggers PostgREST's serialization retry runner;
-- PT409 returns the conflict to the client, which can load and recompute.
-- Rebuild only these exact functions from their current definitions, keeping
-- security, search_path, timeout settings and privileges intact.
do $migration$
declare
  target record;
  function_oid oid;
  definition text;
  old_count integer;
  new_count integer;
begin
  for target in select * from (values
    ('public.settle_scene_intent_batch(uuid,bigint,bigint[],bigint[],jsonb,jsonb,text)', 2, false),
    ('public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)', 2, false),
    ('public.append_scene_events(uuid,bigint,jsonb,jsonb,text)', 1, false),
    ('public.save_scene_snapshot(uuid,bigint,jsonb,text)', 1, false),
    ('public.save_train_state(uuid,bigint,jsonb)', 1, true)
  ) as targets(signature, expected_raises, optional)
  loop
    function_oid := to_regprocedure(target.signature);
    if function_oid is null then
      if target.optional then continue; end if;
      raise exception 'Required versioned RPC is missing: %', target.signature;
    end if;
    definition := pg_get_functiondef(function_oid);
    select count(*) into old_count from regexp_matches(definition, 'errcode\s*=\s*''40001''', 'gi');
    select count(*) into new_count from regexp_matches(definition, 'errcode\s*=\s*''PT409''', 'gi');
    if old_count + new_count <> target.expected_raises then
      raise exception 'Unexpected conflict raises in %: old %, new %, expected %',
        target.signature, old_count, new_count, target.expected_raises;
    end if;
    if old_count > 0 then
      execute regexp_replace(definition, 'errcode\s*=\s*''40001''', 'errcode = ''PT409''', 'gi');
    end if;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
