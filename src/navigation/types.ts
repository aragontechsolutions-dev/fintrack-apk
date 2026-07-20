import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  ProfileSelect: undefined;
  Login: { userId: string; name: string };
};

export type AppTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Savings: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<AppTabParamList>;
  AddTransaction: { transactionId?: string } | undefined;
  AddTransfer: undefined;
  ReceiptScan: undefined;
  Accounts: undefined;
  AccountForm: { accountId?: string } | undefined;
  AccountDetail: { accountId: string };
  CategoryList: undefined;
  AddUser: undefined;
  Backup: undefined;
  SavingsPlanForm: { planId?: string } | undefined;
  SavingsPlanDetail: { planId: string };
  Budgets: undefined;
};
