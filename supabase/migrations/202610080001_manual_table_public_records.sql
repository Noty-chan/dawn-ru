-- Manual personal records inherit the visibility of their owner. Rebuild existing public snapshots.
begin;

-- Traverse structured metadata: neither hidden actor IDs nor references to a
-- hidden Duel may escape in object keys, nested choices or receipt payloads.
create or replace function public.scene_metadata_visible(metadata jsonb, hidden_ids text[])
returns boolean language sql immutable set search_path = '' as $$
  with recursive nodes(value, key) as (
    select metadata, null::text
    union all
    select child.value, child.key from nodes
    cross join lateral (
      select e.value, e.key from jsonb_each(case when jsonb_typeof(nodes.value)='object' then nodes.value else '{}'::jsonb end) e
      union all
      select a.value, null::text from jsonb_array_elements(case when jsonb_typeof(nodes.value)='array' then nodes.value else '[]'::jsonb end) a
    ) child
  )
  select not exists(select 1 from nodes where key=any(hidden_ids) or (jsonb_typeof(value)='string' and (value #>> '{}')=any(hidden_ids)));
$$;

-- Only public active inventory definitions and their public records are shared.
-- Journals/reservations contain before/after authoritative state.
create or replace function public.scene_actor_public_projection(actor jsonb, hidden_ids text[])
returns jsonb language sql immutable set search_path = '' as $$
  with definitions as (
    select key,item from jsonb_each(coalesce(actor->'lionwing'->'inventory'->'definitions','{}'::jsonb)) entry(key,item)
    where item->>'visibility'='public' and coalesce(item->>'active','true')<>'false'
      and public.scene_metadata_visible(item,hidden_ids)
  ), records as (
    select key,item from jsonb_each(coalesce(actor->'lionwing'->'inventory'->'records','{}'::jsonb)) entry(key,item)
    where item->>'visibility'='public' and item->>'definitionId' in (select key from definitions)
      and public.scene_metadata_visible(item,hidden_ids)
  )
  select (actor - 'notes' - 'privateNotes' - 'ownerId' - 'characterId' - 'profileId' - 'antagonistTraitId' - 'attrs' - 'skills' - 'ability' - 'taintedAbility' - 'techniques' - 'inventory')
    || case when jsonb_typeof(actor->'lionwing'->'inventory')='object' then jsonb_build_object('lionwing',
      ((actor->'lionwing') - 'inventory') || jsonb_build_object('inventory',jsonb_build_object(
        'schema',actor->'lionwing'->'inventory'->'schema','actorId',actor->'id',
        'definitions',coalesce((select jsonb_object_agg(key,item) from definitions),'{}'::jsonb),
        'records',coalesce((select jsonb_object_agg(key,item) from records),'{}'::jsonb)))) else '{}'::jsonb end
    || case when jsonb_typeof(actor->'inventory')='object' then jsonb_build_object('inventory',
      coalesce((select jsonb_object_agg(key,item) from jsonb_each(actor->'inventory') entry(key,item)
        where exists(select 1 from records where records.item->>'definitionId'=entry.key and records.item->>'instanceId' is null)),'{}'::jsonb)) else '{}'::jsonb end;
$$;

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
  ), initiative_items as (
    select item from src, jsonb_array_elements(coalesce(value->'actors','[]'::jsonb)) item
    where src.value->'tablePolicy'->>'mode'='manual' and item->>'hidden'='true' and item->>'manualInitiativeVisible'='true'
    union all
    select item from src, jsonb_array_elements(coalesce(value->'manualInitiative','[]'::jsonb)) item
    where src.value->'tablePolicy'->>'mode'='manual' and item->>'initiativeOnly'='true' and not exists(select 1 from jsonb_array_elements(coalesce(src.value->'actors','[]'::jsonb)) actor where actor->>'id'=item->>'id')
  ), visible_actor_ids as (
    select item->>'id' as id from visible_actors where item ? 'id'
  ), hidden_ids as (
    select coalesce(array_agg(id),'{}'::text[]) as ids from (
      select item->>'id' as id from src, jsonb_array_elements(coalesce(value->'actors','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)
      union
      select clock->>'id' from src, jsonb_array_elements(coalesce(value->'sessionClocks','[]'::jsonb)) clock
      where clock->>'manual'='true' and clock->>'ownerActorId' is not null and clock->>'ownerActorId' not in (select id from visible_actor_ids)
      union
      select item->>'id' from src, lateral (
        select value from jsonb_array_elements(coalesce(src.value->'objects','[]'::jsonb))
        union all select value from jsonb_array_elements(coalesce(src.value->'markers','[]'::jsonb))
        union all select value from jsonb_array_elements(coalesce(src.value->'walls','[]'::jsonb))
        union all select value from jsonb_array_elements(coalesce(src.value->'areas','[]'::jsonb))
      ) records(item)
      where item->>'hidden'='true' or item->>'kind'='hidden' or item->>'type'='hidden' or item->>'visibility'='hidden'
        or item->'metadata'->>'hidden'='true' or item->>'ownerActorId' is not null and item->>'ownerActorId' not in (select id from visible_actor_ids)
      union
      select coalesce(item->>'id',key) from src, jsonb_each(coalesce(value->'lionwing'->'entities','{}'::jsonb)) records(key,item)
      where coalesce(item->>'visibility','public')<>'public'
      union
      select duel->>'id' from src, jsonb_array_elements(coalesce(value->'lionwing'->'duels','[]'::jsonb)) duel
      where duel->>'actorId' not in (select id from visible_actor_ids) or duel->>'targetId' not in (select id from visible_actor_ids)
    ) hidden
  ), visible_artworks as (
    select item
    from src, jsonb_array_elements(coalesce(value->'artworks','[]'::jsonb)) item
    where coalesce((item->>'hidden')::boolean,false)=false
  ), visible_art_ids as (
    select item->>'id' as id from visible_artworks where item ? 'id'
  )
  select (value - 'undo' - 'redo' - 'turnUndo' - 'privateNotes' - 'gmNotes' - 'eventReceipts') || jsonb_build_object(
    'view','player',
    'lionwing',case when jsonb_typeof(value->'lionwing')='object' then
      ((value->'lionwing') - 'history' - 'pausedChains' - 'receipts' - 'deferred' - 'afterAttack' - 'compounds' - 'executionCursor' - 'afterEventReceipts' - 'boundaryReceipts' - 'entityReceipts' - 'entities') || jsonb_build_object(
        'entities',coalesce((select jsonb_object_agg(key,item) from jsonb_each(coalesce(value->'lionwing'->'entities','{}'::jsonb)) entries(key,item) where coalesce(item->>'visibility','public')='public' and public.scene_metadata_visible(item,(select ids from hidden_ids))),'{}'::jsonb),
        'information',case when jsonb_typeof(value->'lionwing'->'information')='object' then
          ((value->'lionwing'->'information') - 'receipts' - 'journal' - 'warnings') || jsonb_build_object(
            'studies',coalesce((select jsonb_agg(item - 'actionInstanceId' - 'actionEventId' - 'rootActionId' - 'sourceDigest' - 'ownerTurnInstanceId' - 'turnInstanceId' - 'createdAt') from jsonb_array_elements(coalesce(value->'lionwing'->'information'->'studies','[]'::jsonb)) item where coalesce(item->>'visibility','public')='public' and public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
            'facts',coalesce((select jsonb_agg(item - 'fingerprint' - 'sourceDigest' - 'createdAt' - 'manualOverride') from jsonb_array_elements(coalesce(value->'lionwing'->'information'->'facts','[]'::jsonb)) item where coalesce(item->>'visibility','public')='public' and public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
            'handouts',coalesce((select jsonb_agg(item - 'fingerprint' - 'sourceDigest' - 'createdAt' - 'manualOverride') from jsonb_array_elements(coalesce(value->'lionwing'->'information'->'handouts','[]'::jsonb)) item where coalesce(item->>'visibility','public')='public' and public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
            'pending','[]'::jsonb
          ) else null end,
        'auras',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'auras','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
        'subscriptions',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'subscriptions','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
        'selections',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'selections','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
        'choices',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'choices','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
        'duels',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'duels','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
        'opportunities',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'opportunities','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
        'grantedTurns',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'lionwing'->'grantedTurns','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb)
      ) else null end,
    'selectedActor',case when value->>'selectedActor' in (select id from visible_actor_ids) then value->'selectedActor' else 'null'::jsonb end,
    'activeActorId',case when value->>'activeActorId' in (select id from visible_actor_ids) then value->'activeActorId' else 'null'::jsonb end,
    'targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(value->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb),
    'sessionClocks',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'sessionClocks','[]'::jsonb)) item where (coalesce(item->>'manual','false')<>'true' or item->>'ownerActorId' is null or item->>'ownerActorId' in (select id from visible_actor_ids)) and public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
    'manualInitiative',case when value->'tablePolicy'->>'mode'='manual' then coalesce((select jsonb_agg(jsonb_build_object('id',item->'id','name',item->'name','space',item->'space','hidden',true,'initiativeOnly',true)) from initiative_items),'[]'::jsonb) else '[]'::jsonb end,
    'manualTable',case when jsonb_typeof(value->'manualTable')='object' then value->'manualTable' || jsonb_build_object('actorId',case when (value->'manualTable'->>'actorId' in (select id from visible_actor_ids) or (value->'tablePolicy'->>'mode'='manual' and exists(select 1 from initiative_items where item->>'id'=src.value->'manualTable'->>'actorId'))) then value->'manualTable'->'actorId' else 'null'::jsonb end) else 'null'::jsonb end,
    'actors',coalesce((select jsonb_agg(public.scene_actor_public_projection(item,(select ids from hidden_ids))) from visible_actors),'[]'::jsonb),
    'objects',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(value->'objects','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids)) and coalesce((item->>'hidden')::boolean,false)=false and (not (item ? 'ownerActorId') or item->>'ownerActorId' is null or item->>'ownerActorId' in (select id from visible_actor_ids))),'[]'::jsonb),
    'walls',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'walls','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids)) and coalesce((item->>'hidden')::boolean,false)=false and (item->>'ownerActorId' is null or item->>'ownerActorId' in (select id from visible_actor_ids))),'[]'::jsonb),
    'markers',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(value->'markers','[]'::jsonb)) item where public.scene_metadata_visible(item,(select ids from hidden_ids)) and coalesce((item->>'hidden')::boolean,false)=false and coalesce(item->>'kind','')<>'hidden' and (item->>'ownerActorId' is null or item->>'ownerActorId' in (select id from visible_actor_ids))),'[]'::jsonb),
    'artworks',coalesce((select jsonb_agg(item - 'privateNotes') from visible_artworks),'[]'::jsonb),
    'backgroundArt',case when value->>'backgroundArt' in (select id from visible_art_ids) then value->'backgroundArt' else 'null'::jsonb end,
    'featuredArt',case when value->>'featuredArt' in (select id from visible_art_ids) then value->'featuredArt' else 'null'::jsonb end,
    'log',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(value->'log','[]'::jsonb)) item where coalesce(item->>'visibility',item->'payload'->>'visibility','public')<>'gm' and public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
    'rollFeed',coalesce((select jsonb_agg(item || jsonb_build_object(
      'targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(item->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb),
      'dice',case when jsonb_typeof(item->'dice')='object' then item->'dice' || jsonb_build_object('targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(item->'dice'->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb)) else item->'dice' end
    )) from jsonb_array_elements(coalesce(value->'rollFeed','[]'::jsonb)) item where coalesce(item->>'visibility','public')<>'gm' and public.scene_metadata_visible(item,(select ids from hidden_ids))),'[]'::jsonb),
    'pendingAction',case
      when jsonb_typeof(value->'pendingAction')='object'
        and value->'pendingAction'->>'actorId' in (select id from visible_actor_ids)
        and (coalesce((value->'pendingAction'->>'allowEmptyTargets')::boolean,false) or exists(select 1 from jsonb_array_elements_text(coalesce(value->'pendingAction'->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)))
      then value->'pendingAction' || jsonb_build_object(
        'targetIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(coalesce(value->'pendingAction'->'targetIds','[]'::jsonb)) as targets(id) where id in (select visible_actor_ids.id from visible_actor_ids)),'[]'::jsonb),
        'targetDamage',coalesce((select jsonb_object_agg(key,damage) from jsonb_each(coalesce(value->'pendingAction'->'targetDamage','{}'::jsonb)) as entries(key,damage) where key in (select id from visible_actor_ids)),'{}'::jsonb),
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

