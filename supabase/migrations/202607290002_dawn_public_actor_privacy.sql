begin;

-- The shared player snapshot keeps public combat state, but not full sheets,
-- ownership ids, or narrator-only enemy metadata. Scene runtime trackers remain
-- visible because each player needs their own canonical combat state.
create or replace function public.public_scene_projection(source jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select (coalesce(source,'{}'::jsonb) - 'undo' - 'privateNotes' - 'gmNotes') || jsonb_build_object(
    'view','player',
    'actors',coalesce((
      select jsonb_agg(
        item
          - 'notes' - 'privateNotes' - 'ownerId' - 'characterId'
          - 'profileId' - 'antagonistTraitId'
          - 'attrs' - 'skills' - 'ability' - 'taintedAbility' - 'techniques'
      )
      from jsonb_array_elements(coalesce(source->'actors','[]'::jsonb)) item
      where coalesce((item->>'hidden')::boolean,false)=false
    ),'[]'::jsonb),
    'objects',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(source->'objects','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false),'[]'::jsonb),
    'markers',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(source->'markers','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false and coalesce(item->>'kind','')<>'hidden'),'[]'::jsonb),
    'artworks',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(source->'artworks','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false),'[]'::jsonb),
    'log',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(source->'log','[]'::jsonb)) item where coalesce(item->>'visibility',item->'payload'->>'visibility','public')<>'gm'),'[]'::jsonb)
  );
$$;

update public.scene_public_snapshots snapshot
set state = public.public_scene_projection(scene.state),
    version = scene.version,
    updated_at = now()
from public.scenes scene
where scene.id = snapshot.scene_id;

commit;
