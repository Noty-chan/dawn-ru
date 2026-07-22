begin;

-- A character sheet is a versioned shared document. Players may overwrite their
-- own row, while narrators can observe changes and explicitly admit the new
-- version to the public scene.
create or replace function public.bump_character_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dawn_character_version on public.characters;
create trigger dawn_character_version
before update on public.characters
for each row execute function public.bump_character_version();

alter table public.characters replica identity full;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='characters') then
      execute 'alter publication supabase_realtime add table public.characters';
    end if;
  end if;
end;
$$;

revoke execute on function public.bump_character_version() from public,anon,authenticated;

commit;
