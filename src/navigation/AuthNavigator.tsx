import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { ProfileSelectScreen } from '../screens/auth/ProfileSelectScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { colors } from '../theme/theme';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { firstRun } = useAuth();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textInverse,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {firstRun ? (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ title: 'Bienvenido a FinTrack' }}
        />
      ) : (
        <>
          <Stack.Screen
            name="ProfileSelect"
            component={ProfileSelectScreen}
            options={{ title: 'Elegí tu perfil' }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Ingresar' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
