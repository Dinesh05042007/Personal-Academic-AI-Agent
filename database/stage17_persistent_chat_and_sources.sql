-- ============================================================================
-- STAGE 17: PERSISTENT AI CHAT, CONVERSATION MEMORY & REAL SOURCES SCHEMA
-- ============================================================================

-- Step 591: Improve conversations table with subject_id
alter table public.conversations
add column if not exists subject_id uuid
references public.subjects(id)
on delete set null;

-- Add sources column to messages to store verified citations permanently
alter table public.messages
add column if not exists sources jsonb default '[]'::jsonb;

-- Step 592: Add message & conversation indexes for high-speed retrieval
create index if not exists messages_conversation_id_idx
on public.messages(conversation_id);

create index if not exists messages_created_at_idx
on public.messages(created_at asc);

create index if not exists conversations_student_id_idx
on public.conversations(student_id);

create index if not exists conversations_subject_id_idx
on public.conversations(subject_id);

-- Step 593: Secure conversations and messages with Row Level Security (RLS)
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Step 594: Conversation RLS Policies
drop policy if exists Students can view own conversations on public.conversations;
create policy Students can view own conversations
on public.conversations
for select
to authenticated
using (
  (select auth.uid()) = student_id
);

drop policy if exists Students can create own conversations on public.conversations;
create policy Students can create own conversations
on public.conversations
for insert
to authenticated
with check (
  (select auth.uid()) = student_id
);

drop policy if exists Students can update own conversations on public.conversations;
create policy Students can update own conversations
on public.conversations
for update
to authenticated
using (
  (select auth.uid()) = student_id
);

drop policy if exists Students can delete own conversations on public.conversations;
create policy Students can delete own conversations
on public.conversations
for delete
to authenticated
using (
  (select auth.uid()) = student_id
);

-- Step 595: Protect messages via conversation tenant ownership
drop policy if exists Students can view own messages on public.messages;
create policy Students can view own messages
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.student_id = (select auth.uid())
  )
);

drop policy if exists Students can create own messages on public.messages;
create policy Students can create own messages
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.student_id = (select auth.uid())
  )
);
