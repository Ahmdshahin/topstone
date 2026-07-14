import Image from "next/image";
import { Box } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Dynamic Image / Branding */}
      <div className="hidden lg:flex w-1/2 relative bg-zinc-900 overflow-hidden items-center justify-center">
        <Image
          src="https://images.unsplash.com/photo-1600607688969-a5bfcd64bd28?q=80&w=2940&auto=format&fit=crop"
          alt="Luxury Architecture"
          fill
          className="object-cover opacity-60 mix-blend-overlay"
          priority
          sizes="50vw"
        />
        <div className="relative z-10 p-12 text-center text-white flex flex-col items-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-2xl">
            <Box className="w-8 h-8" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-4">
            Facade Presentation System
          </h1>
          <p className="text-lg text-white/60 font-light max-w-md mx-auto leading-relaxed">
            Enterprise-grade project management and client visualization designed for premium architectural materials.
          </p>
        </div>
      </div>
      
      {/* Right side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-24 bg-background">
        <div className="w-full max-w-md flex flex-col items-center lg:items-start">
          <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center mb-8 lg:hidden shadow-lg">
            <Box className="w-6 h-6" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
