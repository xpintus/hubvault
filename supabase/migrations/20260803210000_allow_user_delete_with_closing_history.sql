/* Keep immutable Daily Closing records when their acting user is deleted. */

alter table public.daily_closings alter column submitted_by drop not null;
alter table public.daily_closings drop constraint if exists daily_closings_submitted_by_fkey;
alter table public.daily_closings add constraint daily_closings_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null;

alter table public.daily_closing_history alter column performed_by drop not null;
alter table public.daily_closing_history drop constraint if exists daily_closing_history_performed_by_fkey;
alter table public.daily_closing_history add constraint daily_closing_history_performed_by_fkey
  foreign key (performed_by) references public.profiles(id) on delete set null;

alter table public.daily_closing_finalizations alter column finalized_by drop not null;
alter table public.daily_closing_finalizations drop constraint if exists daily_closing_finalizations_finalized_by_fkey;
alter table public.daily_closing_finalizations add constraint daily_closing_finalizations_finalized_by_fkey
  foreign key (finalized_by) references public.profiles(id) on delete set null;

comment on column public.daily_closings.submitted_by is
  'Submitting profile; NULL only when that user was subsequently deleted.';
comment on column public.daily_closing_history.performed_by is
  'Acting profile; NULL only when that user was subsequently deleted. The immutable snapshot remains.';
comment on column public.daily_closing_finalizations.finalized_by is
  'Finalizing profile; NULL only when that user was subsequently deleted. report_snapshot remains.';
