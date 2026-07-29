import { NextResponse } from "next/server";

type Locale = "zh" | "en";

function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const locale = typeof body === "object" && body !== null ? (body as { locale?: unknown }).locale : undefined;

  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Locale must be either 'zh' or 'en'." }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set("locale", locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
