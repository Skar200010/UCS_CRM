import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { loadMetaCredentials } from '../lib/metaCredentials';
import type { User } from 'shared';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, orgName: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await useAuthStore.getState().fetchUser();
  },

  signUp: async (email, password, firstName, lastName, orgName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, org_name: orgName },
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !profile) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      set({ user: profile, isAuthenticated: true, isLoading: false });
      loadMetaCredentials();
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
