//Login / SignUp Interfaces
export interface SignUpForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  ageChecked: boolean;
}

export interface SignInForm {
  email: string;
  password: string;
}
