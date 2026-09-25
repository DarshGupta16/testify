-- ==============================================================================
-- Testify - Declarative Database Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. FOLDERS TABLE
create table if not exists public.folders (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    name text not null,
    parent_folder_id text references public.folders(id) on delete cascade,
    color text,
    icon text,
    order_index integer not null default 0,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. SUBJECTS TABLE
create table if not exists public.subjects (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. TESTS TABLE
create table if not exists public.tests (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    title text not null,
    description text,
    subject_id text not null,
    folder_id text references public.folders(id) on delete set null,
    duration_minutes integer,
    total_marks integer not null default 0,
    test_file_name text not null default '',
    test_file_size_formatted text not null default '',
    answer_key_file_name text,
    answer_key_file_size_formatted text,
    status text not null default 'ready',
    questions jsonb not null default '[]'::jsonb,
    blueprint jsonb,
    token_usage jsonb,
    ai_provider text,
    ai_model text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. ATTEMPTS TABLE
create table if not exists public.attempts (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    test_id text not null references public.tests(id) on delete cascade,
    test_title text not null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    duration_seconds_taken integer not null default 0,
    mode text not null default 'exam',
    status text not null default 'completed',
    responses jsonb not null default '{}'::jsonb,
    score numeric not null default 0,
    max_possible_score numeric not null default 0,
    accuracy_percentage numeric not null default 0,
    total_questions integer not null default 0,
    answered_count integer not null default 0,
    correct_count integer not null default 0,
    incorrect_count integer not null default 0,
    unattempted_count integer not null default 0,
    review_count integer not null default 0,
    updated_at timestamptz not null default now()
);

-- 5. SETTINGS TABLE
create table if not exists public.settings (
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    key text not null,
    value jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, key)
);

-- 6. SYNCED API KEYS TABLE (STRICT ENCRYPTED CIPHERTEXT ONLY)
create table if not exists public.synced_api_keys (
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    provider text not null,
    security_mode text not null default 'strict',
    ciphertext text not null,
    iv text not null,
    salt text not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, provider)
);

-- ==============================================================================
-- INDEXES FOR FAST DELTA SYNC AND USER QUERIES
-- ==============================================================================
create index if not exists idx_tests_user_updated on public.tests(user_id, updated_at desc);
create index if not exists idx_folders_user_updated on public.folders(user_id, updated_at desc);
create index if not exists idx_subjects_user_updated on public.subjects(user_id, updated_at desc);
create index if not exists idx_attempts_user_updated on public.attempts(user_id, updated_at desc);
create index if not exists idx_settings_user_updated on public.settings(user_id, updated_at desc);
create index if not exists idx_synced_api_keys_user_updated on public.synced_api_keys(user_id, updated_at desc);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.folders enable row level security;
alter table public.subjects enable row level security;
alter table public.tests enable row level security;
alter table public.attempts enable row level security;
alter table public.settings enable row level security;
alter table public.synced_api_keys enable row level security;

-- Folders RLS
create policy "Users can manage own folders"
    on public.folders for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Subjects RLS
create policy "Users can manage own subjects"
    on public.subjects for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Tests RLS
create policy "Users can manage own tests"
    on public.tests for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Attempts RLS
create policy "Users can manage own attempts"
    on public.attempts for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Settings RLS
create policy "Users can manage own settings"
    on public.settings for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Synced API Keys RLS
create policy "Users can manage own synced api keys"
    on public.synced_api_keys for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS REPLICATION
-- ==============================================================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tests'
    ) then
        alter publication supabase_realtime add table public.tests;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'folders'
    ) then
        alter publication supabase_realtime add table public.folders;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subjects'
    ) then
        alter publication supabase_realtime add table public.subjects;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attempts'
    ) then
        alter publication supabase_realtime add table public.attempts;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
    ) then
        alter publication supabase_realtime add table public.settings;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'synced_api_keys'
    ) then
        alter publication supabase_realtime add table public.synced_api_keys;
    end if;
end $$;

-- ==============================================================================
-- STORAGE BUCKET: ASSESSMENT DIAGRAMS
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'assessment-diagrams',
    'assessment-diagrams',
    true,
    10485760, -- 10MB per diagram image
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Storage RLS Policies
create policy "Public Diagram Read Access"
    on storage.objects for select
    using (bucket_id = 'assessment-diagrams');

create policy "User Diagram Upload Access"
    on storage.objects for insert
    with check (
        bucket_id = 'assessment-diagrams'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "User Diagram Update Access"
    on storage.objects for update
    using (
        bucket_id = 'assessment-diagrams'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "User Diagram Delete Access"
    on storage.objects for delete
    using (
        bucket_id = 'assessment-diagrams'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
