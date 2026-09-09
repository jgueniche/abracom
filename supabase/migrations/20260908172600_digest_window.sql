-- Digest candidates carry the time of the last digest sent to each person, so the worker can run
-- every hour inside the evening window without sending twice (ADR-0029, follow-up).
drop function if exists public.digest_candidates(timestamptz);
create function public.digest_candidates(since timestamptz)
returns table (
  user_id uuid, email text, locale text, first_name text, quiet_hours jsonb, shabbat_mode boolean,
  school_id uuid, timezone text, latitude double precision, longitude double precision,
  notification_id uuid, kind text, payload jsonb, created_at timestamptz,
  last_digest_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
    select n.user_id, u.email::text, p.locale, p.first_name, pref.quiet_hours, pref.shabbat_mode,
           n.school_id, s.timezone, s.latitude, s.longitude,
           n.id, n.kind, n.payload, n.created_at,
           (select max(x.digested_at) from public.notifications x where x.user_id = n.user_id)
    from public.notifications n
    join auth.users u on u.id = n.user_id
    join public.profiles p on p.id = n.user_id
    left join public.schools s on s.id = n.school_id
    cross join lateral public.effective_preference(n.user_id, n.kind) pref
    where n.created_at >= since and n.read_at is null and n.digested_at is null and n.channel = 'inapp'
      and pref.digest
      and not exists (
        select 1 from public.notification_deliveries d
        where d.notification_id = n.id and d.channel = 'email'
      )
    order by n.user_id, n.created_at;
end
$$;
revoke all on function public.digest_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.digest_candidates(timestamptz) to service_role;
