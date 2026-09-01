import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButton } from "@/components/login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">MyMoney</CardTitle>
          <CardDescription>
            Gestión personal de finanzas e inversiones
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error === "no-autorizado" && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Este correo no está autorizado para usar la aplicación.
            </p>
          )}
          <LoginButton />
          <p className="text-center text-xs text-muted-foreground">
            Acceso restringido al propietario.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
