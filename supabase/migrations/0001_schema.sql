-- Macacadas Map: esquema do banco
create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;

-- Perfis ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Macaco',
  color text not null default '#F5B700',
  avatar_url text,
  sharing boolean not null default true,
  created_at timestamptz not null default now()
);

-- Grupos ---------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members(user_id);

-- Pontos de localização (histórico eterno) ------------------------------
create table public.locations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy real,
  speed real,
  recorded_at timestamptz not null default now()
);
create index locations_user_time_idx on public.locations(user_id, recorded_at desc);

-- Dias já simplificados (para não reprocessar)
create table public.simplified_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  points_before int not null,
  points_after int not null,
  primary key (user_id, day)
);

-- Funções auxiliares ----------------------------------------------------
create or replace function public.is_group_member(g uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_group(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select other = (select auth.uid()) or exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-- Cria o perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Criar grupo (gera código de convite e já entra nele)
create or replace function public.create_group(group_name text)
returns public.groups language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  code text;
begin
  if (select auth.uid()) is null then raise exception 'não autenticado'; end if;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups (name, invite_code, created_by)
  values (coalesce(nullif(trim(group_name), ''), 'Macacadas'), code, (select auth.uid()))
  returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, (select auth.uid()));
  return g;
end;
$$;

-- Entrar num grupo pelo código
create or replace function public.join_group(code text)
returns public.groups language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if (select auth.uid()) is null then raise exception 'não autenticado'; end if;
  select * into g from public.groups where invite_code = upper(trim(code));
  if g.id is null then raise exception 'Código de convite inválido'; end if;
  insert into public.group_members (group_id, user_id)
  values (g.id, (select auth.uid())) on conflict do nothing;
  return g;
end;
$$;

-- Última posição de cada pessoa que eu posso ver
create or replace function public.latest_positions()
returns setof public.locations language sql stable security invoker set search_path = '' as $$
  select distinct on (l.user_id) l.*
  from public.locations l
  where public.shares_group(l.user_id)
  order by l.user_id, l.recorded_at desc;
$$;

-- RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.locations enable row level security;
alter table public.simplified_days enable row level security;

create policy "ver perfis do grupo" on public.profiles
  for select to authenticated using (public.shares_group(id));
create policy "editar o próprio perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "ver meus grupos" on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy "ver membros dos meus grupos" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "sair do grupo" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "ver pontos do grupo" on public.locations
  for select to authenticated using (public.shares_group(user_id));
create policy "enviar meus pontos (se compartilhando)" on public.locations
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.sharing)
  );
create policy "apagar meus pontos" on public.locations
  for delete to authenticated using (user_id = (select auth.uid()));

-- simplified_days: sem políticas = só o servidor mexe

-- Tempo real --------------------------------------------------------------
alter publication supabase_realtime add table public.locations, public.profiles;

-- Simplificação dos rastros antigos ---------------------------------------
-- Para cada pessoa/dia com mais de 1 dia, mantém só os pontos que desenham o caminho
-- (Douglas-Peucker com tolerância ~5 m). O primeiro e o último ponto do dia sempre ficam.
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
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.latest_positions() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.latest_positions() to authenticated;

select cron.schedule('simplificar-rastros', '17 4 * * *', $$select public.simplify_old_tracks()$$);
