-- ============================================================================
-- Oakwood University Church — Infrastructure Task Management
-- Database schema (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
-- Run order: extensions → enums → tables → indexes → triggers → RLS → seeds
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";       -- fuzzy/full-text search

-- ---------------------------------------------------------------------------
-- 2. Enumerated types
-- ---------------------------------------------------------------------------
create type user_role        as enum ('admin', 'staff', 'contractor', 'viewer');
create type task_status      as enum ('not_started', 'in_progress', 'blocked', 'done');
create type subtask_status   as enum ('not_started', 'in_progress', 'done');
create type attachment_type  as enum ('photo', 'receipt', 'spec', 'document', 'other');

-- ---------------------------------------------------------------------------
-- 3. Reference tables
-- ---------------------------------------------------------------------------
create table category (
    id          serial primary key,
    name        text not null unique,
    color_hex   text,
    sort_order  int  default 0
);

create table location (
    id          serial primary key,
    name        text not null unique,
    building    text,
    sort_order  int  default 0
);

-- ---------------------------------------------------------------------------
-- 4. User profiles
--    Supabase manages auth.users; this table extends it with app-specific data.
-- ---------------------------------------------------------------------------
create table user_profile (
    id                  uuid primary key references auth.users(id) on delete cascade,
    full_name           text not null,
    email               text not null,
    role                user_role not null default 'viewer',
    phone               text,
    active              boolean not null default true,
    last_login          timestamptz,

    -- Contractor-specific (NULL for non-contractors)
    company_name        text,
    trade               text,
    license_number      text,
    insurance_expiry    date,
    default_labor_rate  numeric(10,2),
    billing_email       text,
    mailing_address     text,
    notes               text,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index user_profile_role_idx   on user_profile(role) where active;
create index user_profile_email_idx  on user_profile(email);

-- ---------------------------------------------------------------------------
-- 5. Tasks
-- ---------------------------------------------------------------------------
create table task (
    id                  uuid primary key default uuid_generate_v4(),
    legacy_id           int  unique,                         -- maps to row 1..25 in original Word doc
    title               text not null,
    description         text,
    priority            int  not null check (priority between 1 and 5),
    status              task_status not null default 'not_started',
    category_id         int  references category(id),
    location_id         int  references location(id),
    assignee_id         uuid references user_profile(id),
    due_date            date,
    needs_by_date       date,
    notes               text,
    created_by          uuid references user_profile(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    completed_at        timestamptz
);

create index task_status_idx       on task(status);
create index task_priority_idx     on task(priority desc, due_date);
create index task_assignee_idx     on task(assignee_id) where assignee_id is not null;
create index task_category_idx     on task(category_id);
create index task_location_idx     on task(location_id);
create index task_title_trgm_idx   on task using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 6. SubTasks
--    The numbered sub-items inside each row's Description column.
-- ---------------------------------------------------------------------------
create table subtask (
    id                  uuid primary key default uuid_generate_v4(),
    task_id             uuid not null references task(id) on delete cascade,
    sequence            int  not null,
    description         text not null,
    labor_cost          numeric(10,2) not null default 0,
    equipment_cost      numeric(10,2) not null default 0,
    status              subtask_status not null default 'not_started',
    completed_at        timestamptz,
    completed_by        uuid references user_profile(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (task_id, sequence)
);

create index subtask_task_idx    on subtask(task_id);
create index subtask_status_idx  on subtask(status);

-- Convenience view: task totals derived from sub-tasks
create or replace view task_with_totals as
select
    t.*,
    coalesce(sum(s.labor_cost), 0)     as total_labor_cost,
    coalesce(sum(s.equipment_cost), 0) as total_equipment_cost,
    coalesce(sum(s.labor_cost + s.equipment_cost), 0) as total_cost,
    count(s.id)                                          as subtask_count,
    count(s.id) filter (where s.status = 'done')         as subtask_done_count
from task t
left join subtask s on s.task_id = t.id
group by t.id;

-- ---------------------------------------------------------------------------
-- 7. Attachments (photos, receipts, spec sheets, etc.)
-- ---------------------------------------------------------------------------
create table attachment (
    id              uuid primary key default uuid_generate_v4(),
    task_id         uuid references task(id) on delete cascade,
    subtask_id      uuid references subtask(id) on delete cascade,
    type            attachment_type not null default 'photo',
    filename        text not null,
    storage_path    text not null,                  -- Supabase Storage object key
    content_type    text,
    size_bytes      bigint,
    caption         text,

    -- Receipt-specific (NULL for non-receipts)
    receipt_amount  numeric(10,2),
    vendor          text,
    receipt_date    date,

    uploaded_by     uuid references user_profile(id),
    uploaded_at     timestamptz not null default now(),

    check ( (task_id is not null) or (subtask_id is not null) ),
    check ( (type = 'receipt' and receipt_amount is not null) or (type <> 'receipt') )
);

create index attachment_task_idx     on attachment(task_id);
create index attachment_subtask_idx  on attachment(subtask_id);
create index attachment_type_idx     on attachment(type);

-- ---------------------------------------------------------------------------
-- 8. Comments
-- ---------------------------------------------------------------------------
create table comment (
    id          uuid primary key default uuid_generate_v4(),
    task_id     uuid not null references task(id) on delete cascade,
    author_id   uuid not null references user_profile(id),
    body        text not null,
    created_at  timestamptz not null default now(),
    edited_at   timestamptz
);

create index comment_task_idx on comment(task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. Audit log — every status change and field edit
-- ---------------------------------------------------------------------------
create table audit_log (
    id          bigserial primary key,
    table_name  text not null,
    record_id   uuid not null,
    action      text not null,         -- 'insert' | 'update' | 'delete'
    changed_by  uuid references user_profile(id),
    changed_at  timestamptz not null default now(),
    old_values  jsonb,
    new_values  jsonb
);

create index audit_log_record_idx on audit_log(table_name, record_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 10. Triggers
-- ---------------------------------------------------------------------------

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

create trigger trg_user_profile_updated  before update on user_profile  for each row execute function set_updated_at();
create trigger trg_task_updated          before update on task          for each row execute function set_updated_at();
create trigger trg_subtask_updated       before update on subtask       for each row execute function set_updated_at();

-- Auto-mark task done when all sub-tasks done
create or replace function maybe_complete_task()
returns trigger language plpgsql as $$
declare
    remaining int;
begin
    select count(*) into remaining
      from subtask
     where task_id = new.task_id
       and status <> 'done';

    if remaining = 0 then
        update task
           set status = 'done',
               completed_at = now()
         where id = new.task_id
           and status <> 'done';
    end if;
    return new;
end $$;

create trigger trg_subtask_complete
    after insert or update of status on subtask
    for each row when (new.status = 'done')
    execute function maybe_complete_task();

-- ---------------------------------------------------------------------------
-- 11. Row-Level Security (skeleton — refine per role)
-- ---------------------------------------------------------------------------
alter table user_profile enable row level security;
alter table task         enable row level security;
alter table subtask      enable row level security;
alter table attachment   enable row level security;
alter table comment      enable row level security;
alter table audit_log    enable row level security;

-- Helper: current user's role
create or replace function current_user_role() returns user_role
language sql security definer stable as $$
    select role from user_profile where id = auth.uid()
$$;

-- user_profile: everyone reads basic info; users edit only their own row;
-- admins do anything.
create policy up_select on user_profile for select using ( true );
create policy up_self_update on user_profile for update
    using  ( id = auth.uid() )
    with check ( id = auth.uid() );
create policy up_admin_all on user_profile for all
    using  ( current_user_role() = 'admin' )
    with check ( current_user_role() = 'admin' );

-- task: admins & staff see all; contractors see only their assigned tasks;
-- viewers read all but cannot mutate.
create policy task_admin_staff_all on task for all
    using  ( current_user_role() in ('admin','staff') )
    with check ( current_user_role() in ('admin','staff') );

create policy task_contractor_select on task for select
    using  ( current_user_role() = 'contractor' and assignee_id = auth.uid() );

create policy task_contractor_update on task for update
    using  ( current_user_role() = 'contractor' and assignee_id = auth.uid() )
    with check ( current_user_role() = 'contractor' and assignee_id = auth.uid() );

create policy task_viewer_select on task for select
    using  ( current_user_role() = 'viewer' );

-- subtask, attachment, comment policies should mirror parent task access.
-- (Implement per-row helper or use security-definer functions; left as TODO.)

-- ---------------------------------------------------------------------------
-- 12. Seed reference data
-- ---------------------------------------------------------------------------
insert into category (name, color_hex, sort_order) values
    ('Surveillance',  '#3B7BD9', 10),
    ('Access Control','#0EA5A4', 20),
    ('AV/Displays',   '#8B5CF6', 30),
    ('Cabling',       '#F59E0B', 40),
    ('Maintenance',   '#10B981', 50),
    ('Other',         '#6B7280', 90)
on conflict (name) do nothing;

insert into location (name, building, sort_order) values
    ('Family Life Center (FLC)', 'FLC',          10),
    ('Sanctuary',                'Main',         20),
    ('Pastoral Suite',           'Main',         30),
    ('Senior Pastor Office',     'Main',         31),
    ('Choir Room',               'Main',         40),
    ('Treasury',                 'Main',         50),
    ('Admin Office',             'Main',         60),
    ('MPRN (North)',             'Main',         70),
    ('MPRS (South)',             'Main',         80),
    ('Main Foyer',               'Main',         90),
    ('Main Lobby',               'Main',        100),
    ('Balcony',                  'Main',        110),
    ('North Entry',              'Main',        120),
    ('Breezeway',                'FLC/Main',    130),
    ('FLC Gym',                  'FLC',         140),
    ('FLC Sprinkler Room',       'FLC',         150),
    ('Video Production Rack',    'Main',        160)
on conflict (name) do nothing;

-- ============================================================================
-- End of schema. Run migrate-tasks.py separately to import the 25 backlog rows.
-- ============================================================================
