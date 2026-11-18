-- Run this script in the Supabase SQL Editor to initialize the database

CREATE TABLE IF NOT EXISTS conclave_users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS conclave_sessions (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    turns JSONB DEFAULT '[]'::jsonb
);

-- Disable RLS for demo deployment so client keys can read/write directly
ALTER TABLE conclave_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE conclave_sessions DISABLE ROW LEVEL SECURITY;
