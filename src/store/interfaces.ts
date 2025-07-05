export interface User {
  token: string;
  id: number;
  email: string;
  username: string;
  created_at?: Date;
  updated_at?: Date;
  error: React.SetStateAction<boolean>;
}

export interface Preferences {}

export interface SignIn {
  email: string;
  password: string;
}
