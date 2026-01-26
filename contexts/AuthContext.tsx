import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { User, UserSport, Sport, UserStats } from '@/types';
import { usersApi } from '@/lib/api/users';
import { notificationsApi } from '@/lib/api/notifications';
import { registerForPushNotifications } from '@/lib/push-notifications';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const AUTH_STORAGE_KEY = 'vs_auth';
const USER_STORAGE_KEY = 'vs_user';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

interface RegisterData {
  phone: string;
  password: string;
  username: string;
  fullName: string;
  city?: string;
  country?: string;
}

interface LoginData {
  phone: string;
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
      if (__DEV__) console.log('[Auth] Checking auth state...');
      
      const [authData, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(USER_STORAGE_KEY),
      ]);

      if (authData && userData) {
        const isAuth = JSON.parse(authData);
        if (isAuth) {
          if (__DEV__) console.log('[Auth] Found stored auth data');
          return { isAuthenticated: true, user: JSON.parse(userData) as User };
        }
      }

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



  const registerPushToken = useCallback(async (userId: string) => {
    try {
      const token = await registerForPushNotifications();
      if (token && token !== 'local-only') {
        await notificationsApi.registerPushToken(userId, token, Platform.OS as 'ios' | 'android' | 'web');
        if (__DEV__) console.log('[Auth] Push token registered');
      }
    } catch (e) {
      if (__DEV__) console.log('[Auth] Push token registration failed:', e);
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      if (__DEV__) console.log('[Auth] Attempting login for:', data.phone);
      
      if (!data.password) {
        throw new Error('Mot de passe requis');
      }

      const user = await usersApi.authenticate(data.phone, data.password);
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
      if (__DEV__) console.log('[Auth] Attempting registration for:', data.phone);

      if (!data.password) {
        throw new Error('Mot de passe requis');
      }

      const userId = uuidv4();
      
      const user = await usersApi.create({
        id: userId,
        username: data.username,
        fullName: data.fullName,
        phone: data.phone,
        password: data.password,
        city: data.city,
        country: data.country,
      });

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

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      if (__DEV__) console.log('[Auth] Updating profile...');
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
        if (__DEV__) console.log('[Auth] Stats update to server failed, saving locally');
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
      if (__DEV__) console.log('[Auth] Starting logout process...');
      await AsyncStorage.multiRemove([
        AUTH_STORAGE_KEY,
        USER_STORAGE_KEY,
      ]);
      if (__DEV__) console.log('[Auth] Logout complete');
    },
    onSuccess: () => {
      setAuthState({ isAuthenticated: false, isLoading: false, user: null });
      queryClient.clear();
    },
    onError: (error) => {
      console.error('[Auth] Logout error:', error);
      setAuthState({ isAuthenticated: false, isLoading: false, user: null });
      queryClient.clear();
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (confirmText: string) => {
      if (__DEV__) console.log('[Auth] Starting account deletion...');
      if (confirmText !== 'SUPPRIMER') {
        throw new Error('Confirmation invalide');
      }

      if (authState.user) {
        try {
          await usersApi.delete(authState.user.id);
        } catch (e) {
          if (__DEV__) console.log('[Auth] Backend deletion failed:', e);
        }
      }

      await AsyncStorage.multiRemove([
        AUTH_STORAGE_KEY,
        USER_STORAGE_KEY,
        'vs_settings',
      ]);
      if (__DEV__) console.log('[Auth] Account deletion complete');
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
    const uri = await pickAvatarMutation.mutateAsync();
    await updateProfileMutation.mutateAsync({ avatar: uri });
    return uri;
  }, [pickAvatarMutation, updateProfileMutation]);

  const addSport = useCallback(async (sport: UserSport) => {
    if (!authState.user) return;
    const updatedSports = [...authState.user.sports.filter(s => s.sport !== sport.sport), sport];
    await updateProfile({ sports: updatedSports });
  }, [authState.user, updateProfile]);

  const removeSport = useCallback(async (sportType: Sport) => {
    if (!authState.user) return;
    await updateProfile({ sports: authState.user.sports.filter(s => s.sport !== sportType) });
  }, [authState.user, updateProfile]);

  const refreshUser = useCallback(async () => {
    if (!authState.user) return;
    try {
      const user = await usersApi.getById(authState.user.id);
      setAuthState(prev => ({ ...prev, user }));
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userData) setAuthState(prev => ({ ...prev, user: JSON.parse(userData) }));
    }
  }, [authState.user]);

  const makeAdmin = useCallback(async () => {
    if (!authState.user) return;
    const updatedUser: User = { ...authState.user, role: 'admin' };
    
    try {
      await usersApi.update(authState.user.id, { role: 'admin' });
    } catch (e) {
      if (__DEV__) console.log('[Auth] Admin promotion to server failed');
    }
    
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    setAuthState(prev => ({ ...prev, user: updatedUser }));
    queryClient.invalidateQueries({ queryKey: ['auth'] });
        if (__DEV__) console.log('[Auth] User promoted to admin');
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
    isAdmin: authState.user?.role === 'admin',
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
