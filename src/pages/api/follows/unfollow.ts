import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const followeeId = String(form.get("followee_id") || "").trim();

  if (!followeeId) {
    return context.redirect("/home?error=missing_user");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", followeeId);

  return context.redirect(context.request.headers.get("referer") || "/home");
};
