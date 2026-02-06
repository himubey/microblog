import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  const usernameRaw = String(form.get("username") || "").trim();
  const username = usernameRaw.toLowerCase();
  const name = String(form.get("name") || "").trim();

  if (!email || !password || !confirm || !username || !name) {
    return context.redirect("/signup?error=missing");
  }
  if (password !== confirm) {
    return context.redirect("/signup?error=nomatch");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: existingUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existingUsername) {
    return context.redirect("/signup?error=username_taken");
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        name,
      },
    },
  });

  if (error) {
    const msg = encodeURIComponent(error.message || "Could not create account.");
    return context.redirect(`/signup?error=${msg}`);
  }

  return context.redirect("/");
};
