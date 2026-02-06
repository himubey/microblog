import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  if (!email || !password) {
    return context.redirect("/login?error=missing");
  }

  const supabase = getSupabaseServerClient(context);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = encodeURIComponent(error.message || "Invalid email or password.");
    return context.redirect(`/login?error=${msg}`);
  }

  return context.redirect("/");
};
