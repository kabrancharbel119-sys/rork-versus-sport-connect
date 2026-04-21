import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { User, UserSport, Sport, UserStats } from '@/types';
import { notificationsApi } from '@/lib/api/notifications';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { signUp, signIn, signOut, getCurrentUser } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';
import { usersApi } from '@/lib/api/users';
import { logger } from '@/lib/logger';
import { uploadAvatarImage } from '@/lib/uploadImage';

const AUTH_STORAGE_KEY = 'vs_auth';
const USER_STORAGE_KEY = 'vs_user';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

interface RegisterData {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  city?: string;
  referralCode?: string;
  role?: 'user' | 'venue_manager';
}

interface LoginData {
  email: string;
  password: string;
}

interface UpdateProfileData {
  fullName?: string;
  username?: string;
  phone?: string;
  city?: string;
  country?: string;
  bio?: string;
  avatar?: string;
  sports?: UserSport[];
  isProfileVisible?: boolean;
}



export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  const authQuery = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      logger.debug('Auth', 'Checking auth state...');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        try {
          const profile = await getCurrentUser();
          if (profile) {
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
            return { isAuthenticated: true, user: profile };
          }
        } catch (e: any) {
          // enforceBanPolicy throws when user is banned → force logout
          if (e?.message?.includes('suspendu')) {
            logger.debug('Auth', 'User is banned, forcing logout');
            await AsyncStorage.multiRemove([USER_STORAGE_KEY, AUTH_STORAGE_KEY]);
            return { isAuthenticated: false, user: null, banMessage: e.message };
          }
          throw e;
        }
      }

      // Session invalide ou expirée - vider AsyncStorage immédiatement
      await AsyncStorage.multiRemove([USER_STORAGE_KEY, AUTH_STORAGE_KEY]);
      return { isAuthenticated: false, user: null };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (authQuery.data) {
      setAuthState({
        isAuthenticated: authQuery.data.isAuthenticated,
        isLoading: false,
        user: authQuery.data.user,
      });
    } else if (!authQuery.isLoading) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authQuery.data, authQuery.isLoading]);

  // Periodic ban check: every 30s, verify the logged-in user is not banned
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.user?.id) return;

    const checkBan = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_banned')
          .eq('id', authState.user!.id)
          .single();

        if (!error && data?.is_banned) {
          logger.debug('Auth', 'Active ban detected, forcing logout');
          await supabase.auth.signOut();
          await AsyncStorage.multiRemove([USER_STORAGE_KEY, AUTH_STORAGE_KEY]);
          setAuthState({ isAuthenticated: false, isLoading: false, user: null });
          queryClient.clear();
        }
      } catch (_) {
        // Silently ignore check errors
      }
    };

    const interval = setInterval(checkBan, 30000);
    return () => clearInterval(interval);
  }, [authState.isAuthenticated, authState.user?.id, queryClient]);



  const registerPushToken = useCallback(async (userId: string) => {
    try {
      const token = await registerForPushNotifications();
      if (token && token !== 'local-only') {
        await notificationsApi.registerPushToken(userId, token, Platform.OS as 'ios' | 'android' | 'web');
        logger.debug('Auth', 'Push token registered');
      }
    } catch (e) {
      logger.debug('Auth', 'Push token registration failed', e);
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      logger.debug('Auth', 'Attempting login for:', data.email);
      
      if (!data.password) {
        throw new Error('Mot de passe requis');
      }

      await signIn(data.email, data.password);
      const user = await getCurrentUser();
      
      if (!user) throw new Error('Utilisateur non trouvé');
      
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(true));
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      
      return user;
    },
    onSuccess: (user) => {
      setAuthState({ isAuthenticated: true, isLoading: false, user });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      registerPushToken(user.id);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      logger.debug('Auth', 'Attempting registration for:', data.email);

      if (!data.password) {
        throw new Error('Mot de passe requis');
      }

      const profile = await signUp({
        email: data.email,
        password: data.password,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        city: data.city,
        referralCode: data.referralCode,
        role: data.role,
      });

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(true));
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));

      return profile;
    },
    onSuccess: (user) => {
      setAuthState({ isAuthenticated: true, isLoading: false, user });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      registerPushToken(user.id);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      logger.debug('Auth', 'Updating profile...');
      if (!authState.user) throw new Error('Non authentifié');

      try {
        const updatedUser = await usersApi.update(authState.user.id, data);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
        return updatedUser;
      } catch (e) {
        const updatedUser: User = { ...authState.user, ...data };
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
        return updatedUser;
      }
    },
    onSuccess: (user) => {
      setAuthState(prev => ({ ...prev, user }));
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
  });

  const updateStatsMutation = useMutation({
    mutationFn: async (statsUpdate: Partial<UserStats>) => {
      if (!authState.user) throw new Error('Non authentifié');
      const updatedStats = { ...authState.user.stats, ...statsUpdate };
      const updatedUser: User = { ...authState.user, stats: updatedStats };
      
      try {
        await usersApi.update(authState.user.id, { stats: updatedStats });
      } catch (e) {
        logger.debug('Auth', 'Stats update to server failed, saving locally');
      }
      
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    },
    onSuccess: (user) => {
      setAuthState(prev => ({ ...prev, user }));
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const pickAvatarMutation = useMutation({
    mutationFn: async () => {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        return new Promise<string>((resolve, reject) => {
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            } else reject(new Error('No file selected'));
          };
          input.click();
        });
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Permission refusée');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) throw new Error('Annulé');
      return result.assets[0].uri;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      logger.debug('Auth', 'Starting logout process...');
      await signOut();
      await AsyncStorage.multiRemove([
        AUTH_STORAGE_KEY,
        USER_STORAGE_KEY,
      ]);
      logger.debug('Auth', 'Logout complete');
    },
    onSuccess: () => {
      setAuthState({ isAuthenticated: false, isLoading: false, user: null });
      queryClient.clear();
    },
    onError: (error) => {
      logger.error('Auth', 'Logout error:', error);
      setAuthState({ isAuthenticated: false, isLoading: false, user: null });
      queryClient.clear();
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (confirmText: string) => {
      logger.debug('Auth', 'Starting account deletion...');
      if (confirmText !== 'SUPPRIMER') {
        throw new Error('Confirmation invalide');
      }

      if (authState.user) {
        await usersApi.delete(authState.user.id);
      }

      await AsyncStorage.multiRemove([
        AUTH_STORAGE_KEY,
        USER_STORAGE_KEY,
        'vs_settings',
      ]);
      logger.debug('Auth', 'Account deletion complete');
    },
    onSuccess: () => {
      setAuthState({ isAuthenticated: false, isLoading: false, user: null });
      queryClient.clear();
    },
  });



  const login = useCallback((data: LoginData) => loginMutation.mutateAsync(data), [loginMutation]);
  const register = useCallback((data: RegisterData) => registerMutation.mutateAsync(data), [registerMutation]);
  const updateProfile = useCallback((data: UpdateProfileData) => updateProfileMutation.mutateAsync(data), [updateProfileMutation]);
  const updateStats = useCallback((stats: Partial<UserStats>) => updateStatsMutation.mutateAsync(stats), [updateStatsMutation]);
  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation]);
  const deleteAccount = useCallback((confirmText: string) => deleteAccountMutation.mutateAsync(confirmText), [deleteAccountMutation]);

  const pickAvatar = useCallback(async () => {
    const localUri = await pickAvatarMutation.mutateAsync();
    const userId = authState.user?.id;
    let avatarUrl = localUri;
    if (userId && (localUri.startsWith('file://') || localUri.startsWith('blob:') || localUri.startsWith('data:') || localUri.startsWith('ph://'))) {
      avatarUrl = await uploadAvatarImage(localUri, userId);
    }
    await updateProfileMutation.mutateAsync({ avatar: avatarUrl });
    return avatarUrl;
  }, [pickAvatarMutation, updateProfileMutation, authState.user?.id]);

  const addSport = useCallback(async (sport: UserSport) => {
    if (!authState.user) return;
    const existing = (authState.user.sports ?? []).filter(s => s.sport !== sport.sport);
    const updatedSports = [...existing, sport];
    await updateProfile({ sports: updatedSports });
  }, [authState.user, updateProfile]);

  const removeSport = useCallback(async (sportType: Sport) => {
    if (!authState.user) return;
    await updateProfile({ sports: (authState.user.sports ?? []).filter(s => s.sport !== sportType) });
  }, [authState.user, updateProfile]);

  const refreshUser = useCallback(async () => {
    if (!authState.user?.id) return;
    try {
      const updated = await usersApi.getById(authState.user.id);
      if (updated) {
        setAuthState(prev => ({ ...prev, user: updated }));
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (error) {
      logger.error('AuthContext', 'refreshUser error:', error);
    }
  }, [authState.user]);

  const makeAdmin = useCallback(async () => {
    if (!authState.user) return;
    const updatedUser: User = { ...authState.user, role: 'admin' };
    
    try {
      await usersApi.update(authState.user.id, { role: 'admin' });
    } catch (e) {
      logger.debug('Auth', 'Admin promotion to server failed');
    }
    
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    setAuthState(prev => ({ ...prev, user: updatedUser }));
    queryClient.invalidateQueries({ queryKey: ['auth'] });
        logger.debug('Auth', 'User promoted to admin');
  }, [authState.user, queryClient]);

  const upgradeToVenueManager = useCallback(async () => {
    if (!authState.user) return;
    const updatedUser: User = { ...authState.user, role: 'venue_manager' };
    
    try {
      await usersApi.update(authState.user.id, { role: 'venue_manager' });
    } catch (e) {
      logger.debug('Auth', 'Venue manager upgrade to server failed');
    }
    
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    setAuthState(prev => ({ ...prev, user: updatedUser }));
    queryClient.invalidateQueries({ queryKey: ['auth'] });
    logger.debug('Auth', 'User upgraded to venue_manager');
  }, [authState.user, queryClient]);

  return {
    ...authState,
    login,
    register,
    updateProfile,
    updateStats,
    logout,
    deleteAccount,
    addSport,
    removeSport,
    pickAvatar,
    refreshUser,
    makeAdmin,
    upgradeToVenueManager,
    isAdmin: authState.user?.role === 'admin',
    isVenueManager: authState.user?.role === 'venue_manager',
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isUpdateLoading: updateProfileMutation.isPending,
    isPickingAvatar: pickAvatarMutation.isPending,
    isDeleteLoading: deleteAccountMutation.isPending,
    loginError: loginMutation.error?.message,
    registerError: registerMutation.error?.message,
    deleteError: deleteAccountMutation.error?.message,
  };
});
