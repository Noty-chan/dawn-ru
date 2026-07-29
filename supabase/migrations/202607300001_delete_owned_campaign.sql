begin;

create or replace function public.delete_owned_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_campaign_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_campaign_id is null then
    raise exception 'campaign id required';
  end if;

  delete from public.campaigns
  where id = p_campaign_id
    and owner_id = auth.uid()
  returning id into deleted_campaign_id;

  return deleted_campaign_id is not null;
end;
$$;

revoke execute on function public.delete_owned_campaign(uuid) from public, anon;
grant execute on function public.delete_owned_campaign(uuid) to authenticated;

commit;
