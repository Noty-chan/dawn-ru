begin;

-- Qualify the target row explicitly so the subquery cannot bind these names
-- to scene_public_snapshots and accidentally compare each column to itself.
drop policy if exists commands_member_insert on public.scene_commands;
create policy commands_member_insert
on public.scene_commands
for insert to authenticated
with check (
  scene_commands.actor_id = (select auth.uid())
  and public.is_campaign_member(scene_commands.campaign_id)
  and exists(
    select 1
    from public.scene_public_snapshots as snapshot
    where snapshot.scene_id = scene_commands.scene_id
      and snapshot.campaign_id = scene_commands.campaign_id
  )
);

commit;
