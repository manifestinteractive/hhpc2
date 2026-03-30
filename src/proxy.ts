import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBasicAuthConfig, isAuthorizedBasicAuthHeader } from "@/lib/security/basic-auth";

function getUnauthorizedResponse() {
  return new NextResponse("Authentication required.", {
    headers: {
      "WWW-Authenticate": 'Basic realm="HHPC2 Demo", charset="UTF-8"',
    },
    status: 401,
  });
}

export function proxy(request: NextRequest) {
  const config = getBasicAuthConfig();

  if (!config.username || !config.password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");

  if (!isAuthorizedBasicAuthHeader(authorization)) {
    return getUnauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|manifest.webmanifest|sw.js|icons/|robots.txt|sitemap.xml).*)",
  ],
};
