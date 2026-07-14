import { type NextRequest, NextResponse } from "next/server";
// import { updateSession } from "@/lib/supabase/middleware";

const locales = ['ar', 'en'];
const defaultLocale = 'ar';

function getLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) return defaultLocale;
  
  // Very simple language negotiation: defaults to Arabic unless English is requested
  if (acceptLanguage.toLowerCase().includes('en')) return 'en';
  return defaultLocale;
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // 1. Handle i18n Routing
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (!pathnameHasLocale) {
      const locale = getLocale(request);
      request.nextUrl.pathname = `/${locale}${pathname}`;
      return NextResponse.redirect(request.nextUrl);
    }

    // 2. Handle Supabase Auth (on the rewritten/redirected URL)
    // TEMPORARILY DISABLED TO ISOLATE VERCEL EDGE CRASH
    // return await updateSession(request);
    return NextResponse.next();
  } catch (error: any) {
    return new Response(`Middleware Error: ${error?.message || String(error)}`, { status: 200, headers: { 'content-type': 'text/plain' } });
  }
}

export const config = {
  matcher: [
    /*
     * Extremely strict matcher pattern:
     * - Only runs on actual app routes, completely bypassing all static assets, images, and API public routes
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/.*|api/public/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf)$).*)",
  ],
};
