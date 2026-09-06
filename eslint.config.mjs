// Configuración de ESLint (flat config) para el proyecto.
// Sin esto, `next build` NO lintea nada: los errores de estilo y varios fallos
// reales (hooks mal usados, imports rotos) pasaban directo a producción.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const configuracion = [
  {
    // La plantilla de referencia y los scripts sueltos no son código de la app.
    ignores: [
      // Generado por Next en cada build; no es código nuestro.
      "next-env.d.ts",
      "referencia/**",
      "scripts/**",
      ".next/**",
      "node_modules/**",
      "supabase/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Variables sin usar: aviso, y se permite el prefijo `_` para las
      // intencionales (parámetros de firma, capturas de error que se ignoran).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // `any` es un error: en una app de dinero, perder el tipo de un monto o de
      // una fila de Supabase es justo donde aparecen los bugs caros.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default configuracion;
