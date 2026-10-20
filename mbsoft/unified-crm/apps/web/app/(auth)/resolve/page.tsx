import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/session";
import { firstOrgForUser } from "../../../lib/org";

/** 登录后解析跳转：有组织 → 工作台；无组织 → onboarding */
export const dynamic = "force-dynamic";

export default async function ResolvePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const org = await firstOrgForUser(user.id);
  redirect(org ? `/w/${org.slug}/dashboard` : "/onboarding");
}
