"use client";

import { useState } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setLoading(false);
      alert("Error al iniciar sesión: " + error.message);
    }
  }

  return (
    <Button onClick={signIn} disabled={loading} className="w-full" size="lg">
      <GoogleLogo weight="bold" className="size-5" />
      {loading ? "Redirigiendo…" : "Entrar con Google"}
    </Button>
  );
}
