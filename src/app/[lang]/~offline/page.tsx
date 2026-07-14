import { Box, WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-muted text-muted-foreground rounded-2xl flex items-center justify-center mb-8 border border-border">
        <WifiOff className="w-8 h-8" />
      </div>
      
      <h1 className="text-3xl font-light tracking-tight mb-4 text-foreground">
        You are offline
      </h1>
      
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        It looks like you've lost your internet connection. We've saved your progress securely on this device.
      </p>

      <div className="flex gap-4">
        <Link 
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 rounded-md font-medium transition-colors"
        >
          <Box className="w-4 h-4" />
          Return to Cached Dashboard
        </Link>
      </div>
    </div>
  );
}
