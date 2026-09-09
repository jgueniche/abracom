-- Additional foreign keys towards public.profiles (which mirrors auth.users 1:1) so the
-- Data API can embed the author / member profile: `select('*, author:profiles(...)')`.
-- The auth.users references stay in place; both constraints hold at the same time.
alter table public.memberships add constraint memberships_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.class_teachers add constraint class_teachers_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.student_guardians add constraint student_guardians_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.announcements add constraint announcements_author_profile_fkey foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.announcement_reads add constraint announcement_reads_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.class_posts add constraint class_posts_author_profile_fkey foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.homework_completions add constraint homework_completions_user_profile_fkey foreign key (marked_by_user_id) references public.profiles (id) on delete set null;
alter table public.assessments add constraint assessments_teacher_profile_fkey foreign key (teacher_id) references public.profiles (id) on delete set null;
alter table public.individual_notes add constraint individual_notes_author_profile_fkey foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.absences add constraint absences_declared_by_profile_fkey foreign key (declared_by) references public.profiles (id) on delete set null;
alter table public.events add constraint events_created_by_profile_fkey foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.event_rsvps add constraint event_rsvps_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.event_slot_signups add constraint event_slot_signups_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.document_signatures add constraint document_signatures_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.form_responses add constraint form_responses_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.appointment_slots add constraint appointment_slots_teacher_profile_fkey foreign key (teacher_id) references public.profiles (id) on delete cascade;
alter table public.appointment_slots add constraint appointment_slots_booked_by_profile_fkey foreign key (booked_by) references public.profiles (id) on delete set null;
alter table public.threads add constraint threads_created_by_profile_fkey foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.thread_members add constraint thread_members_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.messages add constraint messages_author_profile_fkey foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.message_reactions add constraint message_reactions_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.reports add constraint reports_reporter_profile_fkey foreign key (reporter_id) references public.profiles (id) on delete set null;
alter table public.directory_optins add constraint directory_optins_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.community_posts add constraint community_posts_author_profile_fkey foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.legal_acceptances add constraint legal_acceptances_user_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.audit_log add constraint audit_log_actor_profile_fkey foreign key (actor_id) references public.profiles (id) on delete set null;
