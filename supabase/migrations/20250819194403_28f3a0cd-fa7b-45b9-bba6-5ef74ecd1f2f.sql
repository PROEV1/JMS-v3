
begin;

with target_clients as (
  select c.id
  from public.clients c
  where c.user_id is null
    and c.created_at >= now() - interval '30 days'
    and not exists (select 1 from public.orders o where o.client_id = c.id)
    and not exists (select 1 from public.projects p where p.client_id = c.id)
    and not exists (select 1 from public.payments pay where pay.client_id = c.id)
    and not exists (select 1 from public.messages m where m.client_id = c.id)
    and not exists (select 1 from public.leads l where l.client_id = c.id)
    and not exists (select 1 from public.lead_history lh where lh.client_id = c.id)
    and not exists (select 1 from public.files f where f.client_id = c.id)
),
target_quotes as (
  select q.id
  from public.quotes q
  where (
         q.client_id in (select id from target_clients)
         or not exists (select 1 from public.orders o where o.quote_id = q.id)
       )
    and q.created_at >= now() - interval '30 days'
    and not exists (select 1 from public.payments pay where pay.quote_id = q.id)
    and not exists (select 1 from public.messages m where m.quote_id = q.id)
),
deleted_quote_items as (
  delete from public.quote_items qi
  where qi.quote_id in (select id from target_quotes)
  returning qi.id
),
deleted_quotes as (
  delete from public.quotes q
  where q.id in (select id from target_quotes)
  returning q.id
)
delete from public.clients c
where c.id in (select id from target_clients);

commit;
