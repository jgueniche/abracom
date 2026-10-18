-- Les classes du lecteur dans le socle de la coquille (ADR-0076).
--
-- L'onglet « Classe » menait à `/classes`, qui redirigeait vers `/classes/<id>`,
-- qui redirigeait vers `/classes/<id>/cahier` : trois allers-retours pour un
-- parent d'un enfant, chacun avec son contrôle de session, sa fonction et sa
-- `session_context()`. Et un onglet préchargé qui ne contient qu'une
-- redirection ne sert à rien : le clic repart vers le serveur.
--
-- La barre a donc besoin de savoir, avant le clic, s'il n'y a qu'une classe —
-- c'est ici qu'elle l'apprend, dans l'aller-retour qu'elle paie déjà. Les deux
-- ensembles sont ceux que lit `/classes` : les classes où le lecteur enseigne
-- (non archivées, de l'année en cours) et celles de ses enfants (inscription
-- ouverte, lien non bloqué — `guardian_class_ids`, la même règle que les RLS).
-- Chaque classe porte son école : l'école courante se choisit côté application
-- (ADR-0074), comme pour les adhésions.
--
-- Le reste de la fonction est inchangé ; elle reste `security definer` et cadrée
-- sur `auth.uid()` ligne par ligne.

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
      where n.user_id = uid and n.read_at is null),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'school_id', c.school_id) order by c.name)
      from public.classes c
      where c.id in (
          select ct.class_id
          from public.class_teachers ct
          join public.classes tc on tc.id = ct.class_id
          join public.school_years y on y.id = tc.school_year_id
          where ct.user_id = uid and not tc.archived and y.is_current
        union
          select public.guardian_class_ids(uid)
      )), '[]'::jsonb)
  );
end
$$;

comment on function public.session_context() is
  'Everything the signed-in shell needs, in one round trip: profile, contacts, memberships with their school, legal texts and acceptances, MFA enrolment, unread counts, and the classes the reader teaches or has a child in. Scoped to auth.uid() explicitly.';
revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated, service_role;
