import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background.dark,
        },
        headerTintColor: Colors.text.primary,
        contentStyle: {
          backgroundColor: Colors.background.dark,
        },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />
    </Stack>
  );
}
