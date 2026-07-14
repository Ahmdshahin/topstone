import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "@/app/globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { TranslationProvider } from "@/providers/translation-provider";
import { OfflineToast } from "@/components/ui/offline-toast";
import { getDictionary } from "@/lib/dictionaries";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: "Facade Presentation System",
  description: "Enterprise facade presentation and project management",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const dict = await getDictionary(lang as "ar" | "en");

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#191919" />
      </head>
      <body
        className={`${cairo.variable} ${inter.variable} font-cairo antialiased bg-background text-foreground selection:bg-primary/20 selection:text-primary`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TranslationProvider lang={lang} dict={dict}>
            <AuthProvider>
              {children}
              <Toaster position="top-center" richColors theme="system" />
              <OfflineToast />
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
