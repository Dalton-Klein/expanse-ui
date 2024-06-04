import { SignUpForm, SignInForm } from "./interfaces";

// ***ELECTRON MAKE "" BLANK STRING IF NOT ELECTRON, "https://www.gangs.gg" IF ELECTRON PROD, "http://localhost:3010" if ELECTRON Serve
const endpointURL: String = "";

export const signInUser = async (
  user: SignInForm,
  isGoogleSignIn: boolean
) => {
  const { email, password } = user;
  let result = await fetch(`${endpointURL}/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      password: password,
      isGoogleSignIn,
    }),
  })
    .then((res) => res.json())
    .then((data) => data)
    .catch((err) => console.log("SIGN IN USER ERROR", err));
  return result;
};

export const verifyUser = async (
  email: string,
  vKey: string,
  name: string,
  password: string,
  steam_id: string
) => {
  let result = await fetch(`${endpointURL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vKey,
      username: name,
      email,
      steam_id,
      password,
    }),
  })
    .then((res) => res.json())
    .then((data) => data)
    .catch((err) => console.log("VERIFY USER ERROR", err));
  return result;
};

export const fetchUserData = async (userId: number) => {
  let result = await fetch(
    `${endpointURL}/getUserDetails`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
      }),
    }
  )
    .then((res) => res.json())
    .then((data) => data)
    .catch((err) =>
      console.log("FETCH USER DATA ERROR", err)
    );
  return result;
};

export const resetPassword = async (
  email: string,
  vKey: string,
  password: string
) => {
  try {
    let httpResult = await fetch(
      `${endpointURL}/reset-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vKey,
          email,
          password,
        }),
      }
    );
    const jsonify = httpResult.json();
    return jsonify;
  } catch (error) {
    console.log("Password Reset ERROR", error);
  }
};
