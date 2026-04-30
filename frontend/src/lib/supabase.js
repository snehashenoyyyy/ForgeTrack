import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = (val) => !val || val.includes('YOUR_SUPABASE');

export const supabase = (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey))
  ? null 
  : createClient(supabaseUrl, supabaseAnonKey);
