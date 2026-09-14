-- Session 31 — tout ce que la coquille demande, en un aller-retour (ADR-0062).
--
-- Avant : six requêtes avant que la page commence — le profil, les coordonnées,
-- les adhésions avec leur école, les textes légaux, les acceptations, l'état 2FA
-- — puis deux de plus pour les pastilles (messages et notifications non lus).
-- Elles partent en parallèle, mais ce sont huit connexions et huit allers-retours,
-- sur *chaque* page, et sur une base partagée c'est ce qui se voit.
--
-- Ici, une seule. Tout est cadré sur `auth.uid()` explicitement, ligne par ligne :
-- la fonction est `security definer` pour atteindre `auth.mfa_factors`, elle ne
-- doit donc jamais dépendre des RLS pour se limiter au lecteur.
create or replace function public.session_context()
returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return null;
  end if;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'phone', (select c.phone from public.profile_contacts c where c.user_id = uid),
    'memberships', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object('school', (
          -- seulement ce dont l'application se sert : pas de `select *` sur une
          -- table que le lecteur n'aurait pas forcément le droit de lire en entier
          select jsonb_build_object(
            'id', s.id, 'slug', s.slug, 'name', s.name,
            'locale_default', s.locale_default, 'modules', s.modules,
            'timezone', s.timezone, 'latitude', s.latitude, 'longitude', s.longitude)
          from public.schools s where s.id = m.school_id))
        order by m.created_at)
      from public.memberships m where m.user_id = uid), '[]'::jsonb),
    -- trois lignes, dont la politique de lecture est `using (true)` : le tri par
    -- école et par langue se fait côté application, comme avant.
    'legalDocuments', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.published_at desc)
      from public.legal_documents d), '[]'::jsonb),
    'legalAccepted', coalesce((
      select jsonb_agg(a.legal_document_id)
      from public.legal_acceptances a where a.user_id = uid), '[]'::jsonb),
    'mfaEnrolled', public.mfa_enrolled(uid),
    'unreadMessages', public.unread_message_count(),
    'unreadNotifications', (
      select count(*) from public.notifications n
      where n.user_id = uid and n.read_at is null)
  );
end
$$;

comment on function public.session_context() is
  'Everything the signed-in shell needs, in one round trip: profile, contacts, memberships with their school, legal texts and acceptances, MFA enrolment, unread counts. Scoped to auth.uid() explicitly.';
revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated, service_role;
