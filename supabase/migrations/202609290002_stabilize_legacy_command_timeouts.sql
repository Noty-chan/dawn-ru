begin;

-- The compatibility command endpoint remains active for RU v0.9 scenes.
-- Bound lock waits and total work like the newer scene write RPCs.
alter function public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)
  set lock_timeout = '2s';
alter function public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)
  set statement_timeout = '20s';

commit;
