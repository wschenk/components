import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Button } from "./ui/button";
import { signOut } from "@/app/action";
export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <form action={signOut}>
        <Button type="submit">Sign out</Button>
      </form>
    );
  } else {
    return (
      <Link href="/login">
        <Button>Login</Button>
      </Link>
    );
  }

  return <div></div>;
}
