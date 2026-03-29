-- Run this script in the Supabase SQL Editor to initialize the database

CREATE TABLE IF NOT EXISTS conclave_sessions (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    turns JSONB DEFAULT '[]'::jsonb
);

-- For a rapid hackathon demo, we simply disable RLS to allow our anonymous client keys 
-- to read/write based on the injected `user_email`. In production, use Supabase Auth + RLS.
ALTER TABLE conclave_sessions DISABLE ROW LEVEL SECURITY;
