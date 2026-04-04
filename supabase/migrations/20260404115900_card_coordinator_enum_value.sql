-- PostgreSQL requires new enum labels to be committed before they appear in later
-- statements. This migration must run alone; see 20260404120000_card_coordinator_role.sql.

alter type public.user_role add value 'card_coordinator';
