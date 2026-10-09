-- 006_unique_child_nickname.sql
-- Pro Konto jeden Spitznamen nur einmal (verhindert versehentlich doppelte Profile).
create unique index children_owner_nickname_uniq
  on public.children (owner_id, lower(trim(nickname)));
