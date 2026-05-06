-- One-redemption-per-user flag for coupons (default true).

alter table public.coupons
  add column if not exists one_per_user boolean not null default true;
