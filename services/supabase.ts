import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-url') || supabaseAnonKey.includes('your-anon-key')) {
    console.warn('Supabase credentials missing or invalid. Please check your .env file.');
}

const getStorageKey = () => {
    if (typeof window === 'undefined') return 'supabase-auth';
    try {
        if (!window.name) {
            window.name = 'ssm_tab_' + Math.random().toString(36).substring(2, 11);
        }
        return `supabase-auth-${window.name}`;
    } catch (e) {
        return 'supabase-auth';
    }
};

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            persistSession: false,
            storageKey: getStorageKey(),
            storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
