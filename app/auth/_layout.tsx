import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background.dark },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="choose-type" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="register-manager" />
    </Stack>
  );
}