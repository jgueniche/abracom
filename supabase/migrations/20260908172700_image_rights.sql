-- Image-rights revocation (session 7 follow-up): the direction withdraws a consent, and every
-- photo tag naming the pupil disappears at once. Audited by the Server Action.
create or replace function public.set_image_rights(student uuid, signed boolean)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  school uuid;
  untagged integer := 0;
begin
  select s.school_id into school from public.students s where s.id = student;
  if school is null then
    raise exception 'Élève introuvable' using errcode = 'no_data_found';
  end if;
  if not public.is_school_admin(school, auth.uid()) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if signed then
    update public.students set image_rights_signed_at = coalesce(image_rights_signed_at, now()) where id = student;
  else
    update public.students set image_rights_signed_at = null where id = student;
    update public.class_post_media
    set tagged_student_ids = array_remove(tagged_student_ids, student)
    where student = any (tagged_student_ids);
    get diagnostics untagged = row_count;
  end if;
  return untagged;
end
$$;
revoke all on function public.set_image_rights(uuid, boolean) from public, anon;
grant execute on function public.set_image_rights(uuid, boolean) to authenticated, service_role;
