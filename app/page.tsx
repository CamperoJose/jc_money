import { redirect } from "next/navigation";

export default function Home() {
  // El middleware ya redirige a /login si no hay sesión.
  redirect("/tracking/patrimonio");
}
