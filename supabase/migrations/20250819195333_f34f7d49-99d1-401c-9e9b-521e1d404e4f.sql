
-- 1) Allow messages tied to a client to be deleted automatically when the client is deleted
alter table public.messages
  drop constraint if exists messages_client_id_fkey;

alter table public.messages
  add constraint messages_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete cascade;

-- 2) Allow deleting an auth user without blocking because of messages they sent
--    a) make sender_id nullable
alter table public.messages
  alter column sender_id drop not null;

--    b) re-create FK to auth.users with ON DELETE SET NULL
alter table public.messages
  drop constraint if exists messages_sender_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete set null;
