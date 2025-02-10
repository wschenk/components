"use server";

import { createClient } from "@/utils/supabase/server";
import { encodedRedirect } from "@/utils/utils";

export const signInWithEmail = async (email: string, password?: string) => {
  if (email && password) {
    return signInWithPassword(email, password);
  }

  if (!email) {
    return encodedRedirect("error", "/login", "Email is required");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      // set this to false if you do not want the user to be automatically signed up
      shouldCreateUser: true,
      emailRedirectTo: "/auth/callback",
    },
  });

  if (error) {
    return encodedRedirect("error", "/login", error.message);
  }

  return encodedRedirect("success", "/login", "Magic link sent to email");
};

export const signInWithPassword = async (email: string, password: string) => {
  console.log("signInWithPassword", email, password);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/login", error.message);
  }

  return encodedRedirect("success", "/", "Signed in");
};

export const signOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  encodedRedirect("success", "/", "Signed out");
};

export const sendPasswordResetEmail = async (email: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`,
  });

  if (error) {
    return encodedRedirect("error", "/forgot-password", error.message);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Password reset link sent to your email"
  );
};

export const updatePassword = async (password: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return encodedRedirect("error", "/update-password", error.message);
  }

  return encodedRedirect("success", "/login", "Password updated successfully");
};

export const signUpWithEmail = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/signup",
      "Email and password are required"
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return encodedRedirect("error", "/signup", error.message);
  }

  return encodedRedirect(
    "success",
    "/login",
    "Account created. Check your email to verify."
  );
};
