import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '../theme/theme';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { SavingsScreen } from '../screens/savings/SavingsScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

const ICONS: Record<keyof AppTabParamList, string> = {
  Dashboard: '🏠',
  Transactions: '💸',
  Savings: '🎯',
  Reports: '📊',
  Settings: '⚙️',
};

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textInverse,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 20 : 18 }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Inicio' }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Movimientos' }}
      />
      <Tab.Screen
        name="Savings"
        component={SavingsScreen}
        options={{ title: 'Ahorro' }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reportes' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Ajustes' }}
      />
    </Tab.Navigator>
  );
}
