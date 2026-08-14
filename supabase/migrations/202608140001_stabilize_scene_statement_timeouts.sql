begin;

-- Scene ticks can briefly wait behind another narrator write while also
-- projecting a large public snapshot. Fail lock contention quickly so the
-- idempotent client queue can retry, but leave enough execution time for the
-- projection itself once the row lock has been acquired.
alter function public.settle_scene_intent_batch(uuid,bigint,bigint[],bigint[],jsonb,jsonb,text)
  set lock_timeout = '2s';
alter function public.settle_scene_intent_batch(uuid,bigint,bigint[],bigint[],jsonb,jsonb,text)
  set statement_timeout = '20s';

alter function public.append_scene_events(uuid,bigint,jsonb,jsonb,text)
  set lock_timeout = '2s';
alter function public.append_scene_events(uuid,bigint,jsonb,jsonb,text)
  set statement_timeout = '20s';

alter function public.save_scene_snapshot(uuid,bigint,jsonb,text)
  set lock_timeout = '2s';
alter function public.save_scene_snapshot(uuid,bigint,jsonb,text)
  set statement_timeout = '20s';

commit;
