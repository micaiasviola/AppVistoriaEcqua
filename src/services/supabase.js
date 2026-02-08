import { createClient } from '@supabase/supabase-js';

// Substitua pelos valores que você pegou no painel do Supabase
export const supabaseUrl = 'https://gmnuhknldkywaslxmfsj.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbnVoa25sZGt5d2FzbHhtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjk3OTYsImV4cCI6MjA4NTcwNTc5Nn0.Qa1Z0RWKs8UQSiV-BIwHlbTQuylfeaOBnZfkgq7KQvE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);