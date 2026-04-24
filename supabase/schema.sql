create extension if not exists "pgcrypto";

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  rx_number text not null,
  medication_name text not null,
  status text not null check (status in ('canceled', 'pulled', 'returned_to_stock')),

  canceled_at timestamptz not null,
  pull_due_date date not null,
  pulled_at timestamptz,
  returned_to_stock_at timestamptz,

  cancel_note text,

  is_antibiotic boolean not null default false,
  is_waiter boolean not null default false,
  is_fridge_item boolean not null default false,
  is_narcotic boolean not null default false,
  is_central_fill boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists idx_prescriptions_pull_due_date
  on prescriptions (pull_due_date)
  where status = 'canceled';

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  outcome text not null check (outcome in ('called', 'left_message', 'no_answer')),
  note text,
  called_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_call_logs_prescription_id on call_logs (prescription_id);
create index if not exists idx_call_logs_called_at on call_logs (called_at);
