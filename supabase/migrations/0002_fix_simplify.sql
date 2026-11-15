-- Corrige a contagem de pontos na simplificação dos rastros antigos
create or replace function public.simplify_old_tracks(tolerance_m double precision default 5)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  removed_total int := 0;
  before_n int;
  after_n int;
begin
  for r in
    select d.user_id, d.day from (
      select distinct l.user_id, (l.recorded_at at time zone 'America/Sao_Paulo')::date as day
      from public.locations l
    ) d
    where d.day < (now() at time zone 'America/Sao_Paulo')::date
      and not exists (
        select 1 from public.simplified_days s
        where s.user_id = d.user_id and s.day = d.day
      )
  loop
    with pts as (
      select id, extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326), 3857) as g, recorded_at
      from public.locations
      where user_id = r.user_id
        and (recorded_at at time zone 'America/Sao_Paulo')::date = r.day
    ),
    line as (
      select extensions.st_simplify(extensions.st_makeline(g order by recorded_at), tolerance_m) as simp,
             count(*) as n
      from pts
    ),
    kept as (
      select (extensions.st_dumppoints(simp)).geom as g from line where n > 2
    ),
    keep_ids as (
      select p.id from pts p
      where exists (select 1 from kept k where extensions.st_equals(p.g, k.g))
    ),
    del as (
      delete from public.locations l
      using pts p
      where l.id = p.id
        and (select n from line) > 2
        and p.id not in (select id from keep_ids)
      returning 1
    )
    select (select n from line), (select count(*) from del) into before_n, after_n;

    after_n := before_n - after_n;
    removed_total := removed_total + (before_n - after_n);
    insert into public.simplified_days (user_id, day, points_before, points_after)
    values (r.user_id, r.day, before_n, after_n);
  end loop;
  return removed_total;
end;
$$;
revoke execute on function public.simplify_old_tracks(double precision) from public, anon, authenticated;
