import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../theme/theme';
import { AppTabs } from './AppTabs';
import { AddTransactionScreen } from '../screens/transactions/AddTransactionScreen';
import { AddTransferScreen } from '../screens/transactions/AddTransferScreen';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { AccountFormScreen } from '../screens/accounts/AccountFormScreen';
import { AccountDetailScreen } from '../screens/accounts/AccountDetailScreen';
import { CategoryListScreen } from '../screens/categories/CategoryListScreen';
import { AddUserScreen } from '../screens/settings/AddUserScreen';
import { BackupScreen } from '../screens/settings/BackupScreen';
import { SavingsPlanFormScreen } from '../screens/savings/SavingsPlanFormScreen';
import { SavingsPlanDetailScreen } from '../screens/savings/SavingsPlanDetailScreen';
import { BudgetsScreen } from '../screens/budgets/BudgetsScreen';
import { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textInverse,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ title: 'Nuevo movimiento', presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddTransfer"
        component={AddTransferScreen}
        options={{ title: 'Transferencia', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{ title: 'Cuentas' }}
      />
      <Stack.Screen
        name="AccountForm"
        component={AccountFormScreen}
        options={{ title: 'Cuenta', presentation: 'modal' }}
      />
      <Stack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={{ title: 'Detalle de cuenta' }}
      />
      <Stack.Screen
        name="CategoryList"
        component={CategoryListScreen}
        options={{ title: 'Categorías' }}
      />
      <Stack.Screen
        name="AddUser"
        component={AddUserScreen}
        options={{ title: 'Agregar usuario', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Backup"
        component={BackupScreen}
        options={{ title: 'Backups' }}
      />
      <Stack.Screen
        name="SavingsPlanForm"
        component={SavingsPlanFormScreen}
        options={{ title: 'Meta de ahorro', presentation: 'modal' }}
      />
      <Stack.Screen
        name="SavingsPlanDetail"
        component={SavingsPlanDetailScreen}
        options={{ title: 'Meta' }}
      />
      <Stack.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{ title: 'Presupuestos' }}
      />
    </Stack.Navigator>
  );
}
