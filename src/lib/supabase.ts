import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://scedloztcwrbgtbvojvv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZWRsb3p0Y3dyYmd0YnZvanZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDI5NjEsImV4cCI6MjEwMzkxODk2MX0.IYK1aqFpHaVjS_d4xAhTwLBYYgY77ilT2wUxt4sshrk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
