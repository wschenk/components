import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { encodedRedirect } from "@/utils/utils";
import AuthButton from "@/components/auth-button";

export default async function PrivatePage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    encodedRedirect("message", "/login", "User not found");
  }

  if (data && data.user) {
    return (
      <div>
        <p>Hello {data.user.email}</p>
        <AuthButton />
      </div>
    );
  }
  return <p>Hello who knows who you are</p>;
}
