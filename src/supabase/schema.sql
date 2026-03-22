-- KnowEdge Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB DEFAULT '{}',
    plain_text TEXT DEFAULT '',
    type TEXT DEFAULT 'concept' CHECK (type IN ('concept', 'book-note', 'practice', 'idea', 'card', 'tutorial', 'project', 'other', 'reading')),
    tags TEXT[] DEFAULT '{}',
    links TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_synced BOOLEAN DEFAULT FALSE,
    local_id TEXT, -- Local IndexedDB ID for sync reference
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);

-- Enable Row Level Security (optional - for multi-user support)
-- ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies (example for user-based access)
-- CREATE POLICY "Users can CRUD their own notes" ON notes
--     FOR ALL USING (user_id = auth.jwt() ->> 'sub');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-update
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Attachments table for file storage
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'other' CHECK (type IN ('image', 'pdf', 'word', 'excel', 'audio', 'video', 'other')),
    mime_type TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed')),
    remote_url TEXT,
    local_id TEXT, -- Local IndexedDB ID for sync reference
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON attachments(status);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);

-- Trigger for auto-update updated_at
CREATE OR REPLACE FUNCTION update_attachments_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_attachments_updated_at ON attachments;
CREATE TRIGGER update_attachments_updated_at
    BEFORE UPDATE ON attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_attachments_updated_at_column();

-- Storage buckets for file storage
-- Note: Run this in Supabase dashboard or via API to create buckets
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);
