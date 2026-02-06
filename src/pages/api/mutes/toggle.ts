import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const mutedId = String(form.get("muted_id") || "").trim();

  if (!mutedId) {
    return context.redirect("/home?error=missing_user");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  const { data: existing } = await supabase
    .from("mutes")
    .select("muter_id, muted_id")
    .eq("muter_id", user.id)
    .eq("muted_id", mutedId)
    .maybeSingle();

  if (existing) {
    await supabase.from("mutes").delete().eq("muter_id", user.id).eq("muted_id", mutedId);
  } else {
    await supabase.from("mutes").insert({ muter_id: user.id, muted_id: mutedId });
  }

  return context.redirect(context.request.headers.get("referer") || "/home");
};
