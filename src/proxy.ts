import { withAuth } from "next-auth/middleware";
import { isDemoMode } from "@/lib/demo-mode";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => (isDemoMode() ? true : !!token),
  },
});

export const config = {
  matcher: [
    "/labs/:path*",
    "/reagents/:path*",
    "/experiment-check/:path*",
    "/mcp/:path*",
    "/api/labs/:path*",
    "/api/reagents/:path*",
    "/api/experiment/:path*",
    "/api/mcp/tokens/:path*",
  ],
};
