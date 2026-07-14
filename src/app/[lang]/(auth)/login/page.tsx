"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prevState: any, formData: FormData) => {
      const result = await login(formData);
      return result || null;
    },
    null
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-medium tracking-tight mb-2">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to access your projects and presentations.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              className="h-12 bg-secondary/50 focus:bg-background transition-colors"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="h-12 bg-secondary/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        {state?.error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20 font-medium">
            {state.error}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={pending}
          className="w-full h-12 text-sm font-medium tracking-wide shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
      
      <div className="mt-12 pt-8 border-t border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Need an account?</span>
        <a href="#" className="text-foreground font-medium hover:underline">
          Contact an Administrator
        </a>
      </div>
    </motion.div>
  );
}
