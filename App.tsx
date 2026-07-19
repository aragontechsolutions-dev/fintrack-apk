import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * Wraps the app so any touch resets the inactivity auto-logout timer. The
 * wrapper does not claim the responder, so children still receive all touches.
 */
function ActivityBoundary({ children }: { children: React.ReactNode }) {
  const { touch } = useAuth();
  return (
    <View style={{ flex: 1 }} onTouchStart={touch}>
      {children}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ActivityBoundary>
            <StatusBar style="light" />
            <RootNavigator />
          </ActivityBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
