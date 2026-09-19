import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'candidate' | 'supplier' | 'employer' | 'internal';

export type InternalRole =
  | 'super_admin'
  | 'partnerships_lead'
  | 'supplier_partnerships_associate'
  | 'employer_partnerships_associate'
  | 'placement_lead'
  | 'candidate_supplier_rm'
  | 'employer_requirements_rm'
  | 'academic_lead'
  | 'mentor';

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  is_internal?: boolean;
  internal_role?: InternalRole | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  allRoles: InternalRole[];
  activeRole: InternalRole | null;
  hasMultipleRoles: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  refreshSession: () => Promise<{ session: Session | null; profile: Profile | null }>;
  setActiveRole: (role: InternalRole) => void;
  refreshRoles: () => Promise<InternalRole[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allRoles, setAllRoles] = useState<InternalRole[]>([]);
  const [activeRole, setActiveRole] = useState<InternalRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      return null;
    }
  };

  const fetchRoles = async (userId: string, primaryRole?: InternalRole | null): Promise<InternalRole[]> => {
    try {
      const { data, error } = await supabase
        .from('internal_user_roles')
        .select('role, is_primary')
        .eq('profile_id', userId);

      if (!error && data && data.length > 0) {
        const sorted = [...data].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        return sorted.map((r) => r.role as InternalRole);
      }
    } catch (err) {
      console.error('Error fetching internal user roles:', err);
    }
    return primaryRole ? [primaryRole] : [];
  };

  const refreshRoles = async (): Promise<InternalRole[]> => {
    const currentUserId = user?.id || session?.user?.id;
    if (!currentUserId || !profile?.is_internal) {
      setAllRoles([]);
      return [];
    }
    const roles = await fetchRoles(currentUserId, profile.internal_role);
    setAllRoles(roles);
    return roles;
  };

  const refreshProfile = async (): Promise<Profile | null> => {
    let currentUserId = user?.id;
    if (!currentUserId) {
      const { data } = await supabase.auth.getUser();
      currentUserId = data?.user?.id;
      if (data?.user) {
        setUser(data.user);
      }
    }
    if (!currentUserId) {
      setProfile(null);
      setAllRoles([]);
      setActiveRole(null);
      return null;
    }
    const p = await fetchProfile(currentUserId);
    setProfile(p);
    if (p?.is_internal) {
      const roles = await fetchRoles(p.id, p.internal_role);
      setAllRoles(roles);
      setActiveRole((prev) => prev || p.internal_role || roles[0] || null);
    } else {
      setAllRoles([]);
      setActiveRole(null);
    }
    return p;
  };

  const refreshSession = async (): Promise<{ session: Session | null; profile: Profile | null }> => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        const p = await fetchProfile(currentSession.user.id);
        setProfile(p);
        if (p?.is_internal) {
          const roles = await fetchRoles(p.id, p.internal_role);
          setAllRoles(roles);
          setActiveRole((prev) => prev || p.internal_role || roles[0] || null);
        } else {
          setAllRoles([]);
          setActiveRole(null);
        }
        setLoading(false);
        return { session: currentSession, profile: p };
      }
      setProfile(null);
      setAllRoles([]);
      setActiveRole(null);
      setLoading(false);
      return { session: null, profile: null };
    } catch (err) {
      console.error('Error refreshing session:', err);
      setLoading(false);
      return { session: null, profile: null };
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(p);
          if (p?.is_internal) {
            const roles = await fetchRoles(p.id, p.internal_role);
            if (mounted) {
              setAllRoles(roles);
              setActiveRole((prev) => prev || p.internal_role || roles[0] || null);
            }
          } else {
            setAllRoles([]);
            setActiveRole(null);
          }
        }
      } else {
        if (mounted) {
          setProfile(null);
          setAllRoles([]);
          setActiveRole(null);
        }
      }
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const p = await fetchProfile(newSession.user.id);
          if (mounted) {
            setProfile(p);
            if (p?.is_internal) {
              const roles = await fetchRoles(p.id, p.internal_role);
              if (mounted) {
                setAllRoles(roles);
                setActiveRole((prev) => prev || p.internal_role || roles[0] || null);
              }
            } else {
              setAllRoles([]);
              setActiveRole(null);
            }
          }
        } else {
          if (mounted) {
            setProfile(null);
            setAllRoles([]);
            setActiveRole(null);
          }
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setAllRoles([]);
      setActiveRole(null);
    }
  };

  const hasMultipleRoles = allRoles.length > 1;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        allRoles,
        activeRole,
        hasMultipleRoles,
        loading,
        signOut,
        refreshProfile,
        refreshSession,
        setActiveRole,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
