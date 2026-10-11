# Countdown Vault 2.0

Aplicación personal de múltiples objetivos con Next.js, React, TypeScript, Tailwind CSS y Supabase. Exportación estática compatible con GitHub Pages.

## Desarrollo

```sh
npm ci
npm run dev
```

Configura manualmente `.env.local`, que está ignorado por Git:

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

El cliente de `app/lib/supabase.ts` utiliza exclusivamente una clave publicable. Supabase administra la persistencia y renovación de sesión. No hay registro de usuarios ni almacenamiento manual de tokens o fechas.

## Pantallas y datos

- `/`: login; una sesión activa redirige a `/dashboard`.
- `/dashboard`: resumen, próximo objetivo futuro destacado, tarjetas activas ordenadas, filtros locales e historial por fecha de logro descendente.
- `/countdown?id=UUID`: detalle de un objetivo propio.
- `/settings`: crea un objetivo; `/settings?id=UUID` edita uno existente y permite eliminarlo con confirmación.

Todas las pantallas internas requieren sesión mediante `SessionGate`. Los parámetros se leen del lado del cliente dentro de Suspense; no hay rutas dinámicas que necesiten UUID durante el build.

`public.objectives` es la única fuente de verdad. `app/lib/objectives.ts` centraliza las consultas y escrituras, verifica el usuario con `auth.getUser()` y filtra por `user_id` e `id` cuando corresponde. El Dashboard obtiene todas las filas con una consulta principal. RLS sigue siendo la protección real: cada usuario debe poder operar solamente sobre sus propios objetivos. La tabla anterior no se consulta ni modifica.

Crear utiliza `insert`, dejando el UUID a Supabase y estableciendo inicio, creación y modificación al momento de Guardar. Editar utiliza `update`: conserva `started_at` si no cambia el instante objetivo y lo reinicia únicamente al cambiar realmente `target_at`. Los segundos y milisegundos originales se conservan si los campos fecha/hora no cambian. El estado y la fecha de creación se mantienen al editar.

Alcanzar la fecha deja el contador en cero y el progreso rojo al 100 %, pero conserva el estado activo. Marcar como logrado requiere confirmación y establece `status=completed` y `completed_at`; reabrir limpia la fecha de logro y conserva el inicio. Eliminar exige una segunda acción explícita y es permanente.

Las fechas se convierten a ISO en `America/Santiago`, incluyendo horario de verano/invierno. Cada pantalla comparte un único reloj entre sus tarjetas. El acento pertenece a cada objetivo y no altera los colores temporales de la barra. El logo CV se reutiliza en los estados de carga y respeta reducción de movimiento.

## Pruebas

```sh
npm run lint
npm run build
node --test tests/*.test.mjs
```

Las pruebas simulan Auth y PostgREST mediante el SDK oficial; no usan credenciales reales ni contactan Supabase. Verifican sesión, aislamiento por usuario, creación/edición/cambio de fecha, estados, eliminación, Dashboard, filtros, temas, Santiago, progreso y HTML inicial sin contenido protegido.

Pruebas manuales recomendadas:

1. Inicia sesión con un usuario existente; verifica la recuperación de sesión y el acceso protegido a todas las rutas.
2. Comprueba el objetivo migrado y el estado vacío con otro usuario sin objetivos.
3. Crea varios objetivos con fechas y colores diferentes. Verifica el destacado, orden, filtros y diseño en móvil/escritorio.
4. Cambia solo personalización y luego la fecha; comprueba que el inicio se reinicie solamente en el segundo caso.
5. Espera una fecha cercana: debe mostrar Fecha alcanzada sin pasar automáticamente al historial. Confirma logro, reabre y comprueba que conserve el inicio.
6. Cancela y confirma una eliminación; verifica su permanencia. Prueba un UUID ajeno: no debe mostrarse ni editarse.
7. Prueba errores de conexión y Reintentar, campos inválidos, cierre de sesión y el reloj al pasar a medianoche.

## GitHub Pages

`next.config.ts` conserva `output: "export"` y `trailingSlash: true`. El build genera `out/`.

Para construir con el prefijo del repositorio en PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH = '/countdown-vault'
npm run build
```

El workflow existente `.github/workflows/deploy-pages.yml` ejecuta Node.js 24, `npm ci`, lint, build y tests para cada push a `main`, y despliega `out/` mediante las acciones oficiales de Pages. Lee exclusivamente las Repository Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; establece el prefijo `/countdown-vault`.

Sitio: https://badbryan01.github.io/countdown-vault/. Revisa los jobs build y deploy en Actions. `.env.local` nunca se envía al runner.
