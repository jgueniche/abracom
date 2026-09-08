-- Global search (session 13): one ranked query across the content the caller may see.
-- Security invoker on purpose: every branch goes through the tables' RLS policies.
create or replace function public.global_search(q text, max_results integer default 30)
returns table (
  kind text, id uuid, title text, snippet text, happened_at timestamptz, context_id uuid, rank real
)
language sql stable
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('public.french_unaccent', q) as tsq
  ),
  hits as (
    select 'announcement'::text as kind, a.id, a.title,
           ts_headline('public.french_unaccent', a.body_md, query.tsq, 'MaxFragments=1, MaxWords=25, MinWords=8') as snippet,
           coalesce(a.published_at, a.created_at) as happened_at, null::uuid as context_id,
           ts_rank(a.search, query.tsq) as rank
    from public.announcements a, query
    where a.deleted_at is null and a.search @@ query.tsq
    union all
    select 'class_post', p.id, p.title,
           ts_headline('public.french_unaccent', p.body_md, query.tsq, 'MaxFragments=1, MaxWords=25, MinWords=8'),
           coalesce(p.published_at, p.created_at), p.class_id, ts_rank(p.search, query.tsq)
    from public.class_posts p, query
    where p.deleted_at is null and p.search @@ query.tsq
    union all
    select 'message', m.id, left(m.body, 80),
           ts_headline('public.french_unaccent', m.body, query.tsq, 'MaxFragments=1, MaxWords=25, MinWords=8'),
           m.created_at, m.thread_id, ts_rank(m.search, query.tsq)
    from public.messages m, query
    where m.deleted_at is null and m.search @@ query.tsq
    union all
    select 'community', c.id, c.title,
           ts_headline('public.french_unaccent', c.body, query.tsq, 'MaxFragments=1, MaxWords=25, MinWords=8'),
           c.created_at, null, ts_rank(c.search, query.tsq)
    from public.community_posts c, query
    where c.deleted_at is null and c.status = 'published' and c.search @@ query.tsq
    union all
    select 'event', e.id, e.title,
           ts_headline('public.french_unaccent', coalesce(e.description_md, ''), query.tsq, 'MaxFragments=1, MaxWords=25, MinWords=8'),
           e.starts_at, null,
           ts_rank(to_tsvector('public.french_unaccent', e.title || ' ' || coalesce(e.description_md, '')), query.tsq)
    from public.events e, query
    where e.deleted_at is null
      and to_tsvector('public.french_unaccent', e.title || ' ' || coalesce(e.description_md, '')) @@ query.tsq
    union all
    select 'document', d.id, d.title, left(coalesce(d.description_md, ''), 160),
           coalesce(d.published_at, d.created_at), d.folder_id,
           ts_rank(to_tsvector('public.french_unaccent', d.title || ' ' || coalesce(d.description_md, '')), query.tsq)
    from public.documents d, query
    where d.deleted_at is null
      and to_tsvector('public.french_unaccent', d.title || ' ' || coalesce(d.description_md, '')) @@ query.tsq
  )
  select h.kind, h.id, h.title, h.snippet, h.happened_at, h.context_id, h.rank
  from hits h
  where length(trim(q)) >= 2
  order by h.rank desc, h.happened_at desc
  limit greatest(1, least(max_results, 100));
$$;
revoke all on function public.global_search(text, integer) from public, anon;
grant execute on function public.global_search(text, integer) to authenticated, service_role;
