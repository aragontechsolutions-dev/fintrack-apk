import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  ProfileSelect: undefined;
  Login: { userId: string; name: string };
};

export type AppTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Accounts: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<AppTabParamList>;
  AddTransaction: { transactionId?: string } | undefined;
  AddTransfer: undefined;
  AccountForm: { accountId?: string } | undefined;
  AccountDetail: { accountId: string };
  CategoryList: undefined;
  AddUser: undefined;
  Backup: undefined;
};
