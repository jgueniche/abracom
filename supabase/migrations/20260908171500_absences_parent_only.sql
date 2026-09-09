-- Declaring an absence is a parent right: read-only guardians (grand-parents, nannies) cannot.
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated
  with check (
    declared_by = (select auth.uid())
    and school_id = public.student_school_id(student_id)
    and (
      (
        student_id in (select public.guardian_student_ids((select auth.uid())))
        and public.can_write_in_school(school_id, (select auth.uid()))
      )
      or public.is_school_staff(school_id, (select auth.uid()))
    )
  );
