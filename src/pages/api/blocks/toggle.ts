import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const blockedId = String(form.get("blocked_id") || "").trim();

  if (!blockedId) {
    return context.redirect("/home?error=missing_user");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  const { data: existing } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId)
    .maybeSingle();

  if (existing) {
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
  } else {
    await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: blockedId });
    await supabase
      .from("follows")
      .delete()
      .or(
        `and(follower_id.eq.${user.id},followee_id.eq.${blockedId}),and(follower_id.eq.${blockedId},followee_id.eq.${user.id})`
      );
  }

  return context.redirect(context.request.headers.get("referer") || "/home");
};
