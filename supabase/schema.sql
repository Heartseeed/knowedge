-- KnowEdge Database Schema with Multi-User Support
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS notes CASCADE;

-- Notes table with user isolation
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB DEFAULT '{}',
    plain_text TEXT DEFAULT '',
    type TEXT DEFAULT 'concept' CHECK (type IN ('concept', 'book-note', 'practice', 'idea', 'card', 'tutorial', 'project', 'other', 'reading')),
    status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox', 'organized', 'connected')),
    folder_id TEXT,
    tags TEXT[] DEFAULT '{}',
    links TEXT[] DEFAULT '{}',
    starred BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    review_count INTEGER DEFAULT 0,
    next_review_at TIMESTAMPTZ,
    ease_factor DECIMAL(3,2) DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    local_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'other' CHECK (type IN ('image', 'pdf', 'word', 'excel', 'audio', 'video', 'other')),
    mime_type TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed')),
    remote_url TEXT,
    local_url TEXT,
    local_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON attachments(status);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes
DROP POLICY IF EXISTS "Users can CRUD their own notes" ON notes;
CREATE POLICY "Users can CRUD their own notes" ON notes
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- RLS Policies for attachments
DROP POLICY IF EXISTS "Users can CRUD their own attachments" ON attachments;
CREATE POLICY "Users can CRUD their own attachments" ON attachments
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for notes
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for attachments
DROP TRIGGER IF EXISTS update_attachments_updated_at ON attachments;
CREATE TRIGGER update_attachments_updated_at
    BEFORE UPDATE ON attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to set user context for RLS
CREATE OR REPLACE FUNCTION set_user_context(user_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON notes TO anon, authenticated;
GRANT ALL ON attachments TO anon, authenticated;
