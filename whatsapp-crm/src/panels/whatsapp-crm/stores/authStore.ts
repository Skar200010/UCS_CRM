import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { loadMetaCredentials } from '../lib/metaCredentials';
import type { User } from 'shared';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

async function fetchDbUser(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase.rpc('get_whatsapp_user', { p_id: userId });
    if (error || !data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return null;
  }
}

async function createDbUser(authUser: any): Promise<User | null> {
  try {
    const name = authUser.email?.split('@')[0] || 'User';
    const { data, error } = await supabase.rpc('create_whatsapp_user', {
      p_id: authUser.id,
      p_email: authUser.email,
      p_name: name,
    });
    if (error || !data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const { data: agentData, error: agentErr } = await supabase.rpc('verify_agent', {
        p_email: email,
        p_password: password,
      });

      if (agentErr || !agentData) {
        throw new Error('Invalid credentials');
      }

      const userData = typeof agentData === 'string' ? JSON.parse(agentData) : agentData;
      const mappedUser: User = {
        id: userData.id,
        tenant_id: userData.tenant_id || userData.id,
        email: userData.email,
        first_name: userData.name?.split(' ')[0] || '',
        last_name: userData.name?.split(' ').slice(1).join(' ') || '',
        role: (['admin', 'agent', 'viewer'].includes(userData.role) ? userData.role : 'agent') as User['role'],
        status: userData.is_active !== false ? 'active' : 'inactive',
        created_at: userData.created_at || new Date().toISOString(),
      };

      localStorage.setItem('ucs_token', 'rpc_' + userData.id);
      localStorage.setItem('ucs_user', JSON.stringify(mappedUser));
      set({ user: mappedUser, isAuthenticated: true, isLoading: false });
      loadMetaCredentials();
      return;
    }

    if (!data.session) throw new Error('Login failed');

    let dbUser = await fetchDbUser(data.user.id);
    if (!dbUser) {
      dbUser = await createDbUser(data.user);
    }
    if (!dbUser) throw new Error('Failed to load user profile');

    const emailConfirmed = !!data.user.email_confirmed_at;
    let role = dbUser.role;
    if (emailConfirmed && (role === 'agent' || role === 'viewer')) {
      await supabase.rpc('promote_to_admin', { p_id: data.user.id });
      role = 'admin';
    }

    const mappedUser: User = {
      id: dbUser.id,
      tenant_id: dbUser.tenant_id || dbUser.id,
      email: dbUser.email,
      first_name: dbUser.first_name || dbUser.name?.split(' ')[0] || '',
      last_name: dbUser.last_name || dbUser.name?.split(' ').slice(1).join(' ') || '',
      role: (['admin', 'agent', 'viewer'].includes(role) ? role : 'agent') as User['role'],
      status: 'active',
      created_at: dbUser.created_at || new Date().toISOString(),
    };

    localStorage.setItem('ucs_token', data.session.access_token);
    localStorage.setItem('ucs_user', JSON.stringify(mappedUser));
    set({ user: mappedUser, isAuthenticated: true, isLoading: false });
    loadMetaCredentials();
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + '/auth/login' },
    });
    if (error) throw new Error(error.message);
    return { needsVerification: true };
  },

  signOut: async () => {
    localStorage.removeItem('ucs_token');
    localStorage.removeItem('ucs_user');
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchUser: async () => {
    try {
      const storedRaw = localStorage.getItem('ucs_user');
      const token = localStorage.getItem('ucs_token');

      if (storedRaw && token?.startsWith('rpc_')) {
        try {
          const parsed = JSON.parse(storedRaw) as User;
          set({ user: parsed, isAuthenticated: true, isLoading: false });
          loadMetaCredentials();
          return;
        } catch {}
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (storedRaw) {
          try {
            const parsed = JSON.parse(storedRaw) as User;
            set({ user: parsed, isAuthenticated: true, isLoading: false });
            loadMetaCredentials();
            return;
          } catch {}
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const dbUser = await fetchDbUser(session.user.id);

      if (storedRaw && dbUser) {
        try {
          const parsed = JSON.parse(storedRaw) as User;
          const dbRole = (['admin', 'agent', 'viewer'].includes(dbUser.role) ? dbUser.role : 'agent') as User['role'];
          if (parsed.role === dbRole && parsed.id === dbUser.id) {
            set({ user: parsed, isAuthenticated: true, isLoading: false });
            loadMetaCredentials();
            return;
          }
        } catch {}
      }

      if (dbUser) {
        const mappedUser: User = {
          id: dbUser.id,
          tenant_id: dbUser.tenant_id || dbUser.id,
          email: dbUser.email,
          first_name: dbUser.first_name || dbUser.name?.split(' ')[0] || '',
          last_name: dbUser.last_name || dbUser.name?.split(' ').slice(1).join(' ') || '',
          role: (['admin', 'agent', 'viewer'].includes(dbUser.role) ? dbUser.role : 'agent') as User['role'],
          status: 'active',
          created_at: dbUser.created_at || new Date().toISOString(),
        };
        localStorage.setItem('ucs_user', JSON.stringify(mappedUser));
        set({ user: mappedUser, isAuthenticated: true, isLoading: false });
        return;
      }

      if (storedRaw) {
        try {
          const parsed = JSON.parse(storedRaw) as User;
          set({ user: parsed, isAuthenticated: true, isLoading: false });
          loadMetaCredentials();
          return;
        } catch {}
      }

      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
