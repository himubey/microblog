import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const followeeId = String(form.get("followee_id") || "");

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  if (!followeeId || followeeId === user.id) {
    return context.redirect(context.request.headers.get("referer") || "/home");
  }

  await supabase.from("follows").insert({
    follower_id: user.id,
    followee_id: followeeId,
  });

  return context.redirect(context.request.headers.get("referer") || "/home");
};
