-- Move as funções auxiliares de permissão para um schema que não fica exposto na API
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_group_member(g uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_group(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select other = (select auth.uid()) or exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

revoke execute on function private.is_group_member(uuid) from public, anon;
revoke execute on function private.shares_group(uuid) from public, anon;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.shares_group(uuid) to authenticated;

alter policy "ver perfis do grupo" on public.profiles using (private.shares_group(id));
alter policy "ver meus grupos" on public.groups using (private.is_group_member(id));
alter policy "ver membros dos meus grupos" on public.group_members using (private.is_group_member(group_id));
alter policy "ver pontos do grupo" on public.locations using (private.shares_group(user_id));

create or replace function public.latest_positions()
returns setof public.locations language sql stable security invoker set search_path = '' as $$
  select distinct on (l.user_id) l.*
  from public.locations l
  where private.shares_group(l.user_id)
  order by l.user_id, l.recorded_at desc;
$$;

drop function public.is_group_member(uuid);
drop function public.shares_group(uuid);

-- Tabela interna: ninguém de fora acessa
revoke all on public.simplified_days from anon, authenticated;
