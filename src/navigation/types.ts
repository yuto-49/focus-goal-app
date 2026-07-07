export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Goal: undefined;
  Friends: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Watch: { goalId: string };
};
