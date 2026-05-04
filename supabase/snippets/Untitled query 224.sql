-- Pricing for courses + payment audit table for Razorpay flow.

alter table public.courses
  add column if not exists price numeric(10,2) not null default 0,
  add column if not exists discount_percent smallint not null default 0
    check (discount_percent >= 0 and discount_percent <= 100);

create table if not exists public.course_payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  course_id           uuid not null references public.courses(id) on delete cascade,
  razorpay_order_id   text not null,
  razorpay_payment_id text,
  razorpay_signature  text,
  amount_paise        integer not null,
  currency            text not null default 'INR',
  status              text not null default 'created'
    check (status in ('created','paid','failed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists course_payments_order_idx
  on public.course_payments(razorpay_order_id);

create index if not exists course_payments_user_course_idx
  on public.course_payments(user_id, course_id);

alter table public.course_payments enable row level security;

drop policy if exists "users read own payments" on public.course_payments;
create policy "users read own payments" on public.course_payments
  for select using (auth.uid() = user_id);
