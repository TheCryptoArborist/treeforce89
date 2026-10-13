create schema if not exists tree_entry_v1;
revoke all on schema tree_entry_v1 from public,anon,authenticated;
create table if not exists tree_entry_v1.orders (
 id uuid primary key, token_hash text not null unique,
 payer text not null check (payer ~ '^0x[0-9a-f]{64}$'),
 issued_at bigint not null, expires_at bigint not null,
 digest text unique, run_id uuid unique
);
alter table tree_entry_v1.orders enable row level security;
revoke all on tree_entry_v1.orders from public,anon,authenticated;
