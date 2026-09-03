# Referencia de diseño

`template-overview/` es la plantilla **Tremor** que el usuario eligió como base visual
(Next 15 + React 19 + Recharts + TanStack Table + Tailwind v3).

**No se compila ni se despliega**: está aquí solo como referencia de patrones y estilos.
Está excluida de TypeScript y del build (ver `tsconfig.json` → `exclude`).

## Cómo se adapta a este proyecto
La plantilla usa colores hardcoded (`gray-200`, `blue-500`, `dark:bg-[#090E1A]`), pero este
proyecto usa **tokens del tema tweakcn** (`--card`, `--border`, `--primary`, …). Por eso los
componentes se portan a `components/tremor/` **traduciendo** los colores a tokens:

| Plantilla                             | Aquí                 |
|---------------------------------------|----------------------|
| `bg-white dark:bg-[#090E1A]`          | `bg-card`            |
| `border-gray-200 dark:border-gray-800`| `border-border`      |
| `text-gray-900 dark:text-gray-50`     | `text-foreground`    |
| `text-gray-500/600 dark:text-gray-400`| `text-muted-foreground` |
| `blue-500` (acento)                   | `primary`            |
| `red-500`                             | `destructive`        |

Además se usan los iconos **Phosphor** (no Remix) y `cva`/`cn` (no `tailwind-variants`),
que ya son dependencias del proyecto.
