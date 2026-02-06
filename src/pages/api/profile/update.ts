import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const displayName = String(form.get("display_name") || "").trim();
  const usernameRaw = String(form.get("username") || "").trim();
  const username = usernameRaw.toLowerCase();
  const bio = String(form.get("bio") || "").trim();
  const location = String(form.get("location") || "").trim();
  const website = String(form.get("website") || "").trim();

  if (!displayName || !username) {
    return context.redirect("/settings?error=missing");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing && existing.id !== user.id) {
    return context.redirect("/settings?error=username_taken");
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username,
    display_name: displayName,
    bio: bio || null,
    location: location || null,
    website: website || null,
  });

  if (error) {
    const msg = encodeURIComponent(error.message || "Failed to update profile.");
    return context.redirect(`/settings?error=${msg}`);
  }

  // Keep auth metadata in sync as a fallback for UI rendering
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      display_name: displayName,
      username,
      bio: bio || "",
      location: location || "",
      website: website || "",
    },
  });
  if (updateError) {
    const msg = encodeURIComponent(updateError.message || "Failed to update auth profile.");
    return context.redirect(`/settings?error=${msg}`);
  }

  const { data: verifyProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!verifyProfile) {
    return context.redirect("/settings?error=profile_missing");
  }

  return context.redirect("/settings?success=1");
};
