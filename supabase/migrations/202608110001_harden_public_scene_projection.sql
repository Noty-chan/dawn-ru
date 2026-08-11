begin;

-- Keep public combat state playable without leaking Narrator-only actors,
-- rolls, prompts, selections, or artwork through cross-object references.
create or replace function public.public_scene_projection(source jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with src as (
    select coalesce(source,'{}'::jsonb) as value
  ), visible_actors as (
    select item
    from src, jsonb_array_elements(coalesce(value->'actors','[]'::jsonb)) item
    where coalesce((item->>'hidden')::boolean,false)=false
  ), visible_actor_ids as (
    select item->>'id' as id from visible_actors where item ? 'id'
  ), visible_artworks as (
    select item
    from src, jsonb_array_elements(coalesce(value->'artworks','[]'::jsonb)) item
    where coalesce((item->>'hidden')::boolean,false)=false
  ), visible_art_ids as (
    select item->>'id' as id from visible_artworks where item ? 'id'
  )
  select (value - 'undo' - 'redo' - 'privateNotes' - 'gmNotes') || jsonb_build_object(
    'view','player',
    'selectedActor',case when value->>'selectedActor' in (select id from visible_actor_ids) then value->'selectedActor' else 'null'::jsonb end,
    'activeActorId',case when value->>'activeActorId' in (select id from visible_actor_ids) then value->'activeActorId' else 'null'::jsonb end,
    'targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(value->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb),
    'actors',coalesce((select jsonb_agg(item - 'notes' - 'privateNotes' - 'ownerId' - 'characterId' - 'profileId' - 'antagonistTraitId' - 'attrs' - 'skills' - 'ability' - 'taintedAbility' - 'techniques') from visible_actors),'[]'::jsonb),
    'objects',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(value->'objects','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false and (not (item ? 'ownerActorId') or item->>'ownerActorId' is null or item->>'ownerActorId' in (select id from visible_actor_ids))),'[]'::jsonb),
    'markers',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(value->'markers','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false and coalesce(item->>'kind','')<>'hidden'),'[]'::jsonb),
    'artworks',coalesce((select jsonb_agg(item - 'privateNotes') from visible_artworks),'[]'::jsonb),
    'backgroundArt',case when value->>'backgroundArt' in (select id from visible_art_ids) then value->'backgroundArt' else 'null'::jsonb end,
    'featuredArt',case when value->>'featuredArt' in (select id from visible_art_ids) then value->'featuredArt' else 'null'::jsonb end,
    'log',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'log','[]'::jsonb)) item where coalesce(item->>'visibility',item->'payload'->>'visibility','public')<>'gm'),'[]'::jsonb),
    'rollFeed',coalesce((select jsonb_agg(item || jsonb_build_object(
      'targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(item->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb),
      'dice',case when jsonb_typeof(item->'dice')='object' then item->'dice' || jsonb_build_object('targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(item->'dice'->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb)) else item->'dice' end
    )) from jsonb_array_elements(coalesce(value->'rollFeed','[]'::jsonb)) item where coalesce(item->>'visibility','public')<>'gm'),'[]'::jsonb),
    'pendingAction',case
      when jsonb_typeof(value->'pendingAction')='object'
        and value->'pendingAction'->>'actorId' in (select id from visible_actor_ids)
        and (coalesce((value->'pendingAction'->>'allowEmptyTargets')::boolean,false) or exists(select 1 from jsonb_array_elements_text(coalesce(value->'pendingAction'->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)))
      then value->'pendingAction' || jsonb_build_object(
        'targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(value->'pendingAction'->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb),
        'responses',coalesce((select jsonb_object_agg(key,response) from jsonb_each(coalesce(value->'pendingAction'->'responses','{}'::jsonb)) as entries(key,response) where key in (select id from visible_actor_ids)),'{}'::jsonb)
      ) else 'null'::jsonb end,
    'pendingActionPlan',case when jsonb_typeof(value->'pendingActionPlan')='object' and value->'pendingActionPlan'->>'actorId' in (select id from visible_actor_ids) and not exists(select 1 from jsonb_array_elements_text(coalesce(value->'pendingActionPlan'->'context'->'targetIds','[]'::jsonb)) as targets(id) where id not in (select visible_actor_ids.id from visible_actor_ids)) then value->'pendingActionPlan' else 'null'::jsonb end,
    'pendingPrompt',case when jsonb_typeof(value->'pendingPrompt')='object' and value->'pendingPrompt'->>'sourceActorId' in (select id from visible_actor_ids) and (not (value->'pendingPrompt' ? 'targetId') or value->'pendingPrompt'->>'targetId' is null or value->'pendingPrompt'->>'targetId' in (select id from visible_actor_ids)) then value->'pendingPrompt' else 'null'::jsonb end,
    'triggerQueue',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'triggerQueue','[]'::jsonb)) item where coalesce(item->'event'->>'actorId',item->'event'->'payload'->>'sourceActorId') in (select id from visible_actor_ids) and (not (item->'event'->'payload' ? 'targetId') or item->'event'->'payload'->>'targetId' is null or item->'event'->'payload'->>'targetId' in (select id from visible_actor_ids))),'[]'::jsonb),
    'challengeRequest',case when jsonb_typeof(value->'challengeRequest')='object' and value->'challengeRequest'->>'actorId' in (select id from visible_actor_ids) then value->'challengeRequest' else 'null'::jsonb end,
    'opposedRoll',case when jsonb_typeof(value->'opposedRoll')='object' and not exists(select 1 from jsonb_array_elements(coalesce(value->'opposedRoll'->'participants','[]'::jsonb)) participant where participant ? 'actorId' and participant->>'actorId' is not null and participant->>'actorId' not in (select id from visible_actor_ids)) then value->'opposedRoll' else 'null'::jsonb end
  )
  from src;
$$;

update public.scene_public_snapshots snapshot
set state = public.public_scene_projection(scene.state),
    version = scene.version,
    updated_at = now()
from public.scenes scene
where scene.id = snapshot.scene_id;

commit;
