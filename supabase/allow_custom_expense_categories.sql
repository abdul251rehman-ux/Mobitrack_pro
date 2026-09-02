-- Migration: allow custom (free-text) expense categories
-- Run this in your Supabase SQL editor.
--
-- expenses.category has always been restricted to a fixed CHECK-constraint
-- list (supabase/migration.sql). The Expenses UI now lets users type their
-- own category name via a quick-add field, so the constraint must be
-- dropped - Postgres has no ALTER CHECK CONSTRAINT to just widen it.

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
