import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { isDemoMode } from "@/lib/demo-mode";
import { demoRequireUser } from "@/lib/demo-store";

export async function requireUser() {
  return requireUserFromRequest();
}

export async function requireUserFromRequest(req?: Request) {
  const tokenFromReq = req
    ? await getToken({
        req: req as never,
        secret: process.env.NEXTAUTH_SECRET,
      })
    : null;

  if (tokenFromReq?.sub) {
    return {
      id: tokenFromReq.sub,
      email: typeof tokenFromReq.email === "string" ? tokenFromReq.email : undefined,
      name: typeof tokenFromReq.name === "string" ? tokenFromReq.name : undefined,
    };
  }

  if (isDemoMode()) {
    return demoRequireUser(req);
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  const token = await getToken({
    req: { headers: { cookie: cookieHeader } } as { headers: { cookie: string } },
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub && isDemoMode()) {
    return demoRequireUser();
  }

  if (!token?.sub) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    id: token.sub,
    email: typeof token.email === "string" ? token.email : undefined,
    name: typeof token.name === "string" ? token.name : undefined,
  };
}
