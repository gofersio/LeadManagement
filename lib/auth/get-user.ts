import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { UserProfile } from "@prisma/client";

export type AuthenticatedUser = {
  supabaseId: string;
  email: string;
  profile: UserProfile;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  let profile = await prisma.userProfile.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        supabaseUserId: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name ?? user.email.split("@")[0],
      },
    });
  } else if (profile.email !== user.email) {
    profile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        email: user.email,
        fullName: user.user_metadata?.full_name ?? undefined,
      },
    });
  }

  return {
    supabaseId: user.id,
    email: user.email,
    profile,
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
