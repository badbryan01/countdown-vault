# Countdown Vault

Interfaz personal de cuenta regresiva con Next.js, React, TypeScript y Tailwind CSS.

## Desarrollo

```sh
npm install
npm run dev
```

- `/`: login con correo y contraseña mediante Supabase Auth. Una sesión existente redirige al contador.
- `/countdown`: requiere sesión; contador actualizado cada segundo, progreso verde → amarillo → naranjo → rojo y cierre de sesión.
- `/settings`: requiere sesión; carga la fecha existente y permite guardar una fecha futura en Supabase.

La única fuente de fechas es `public.countdowns`. Cada usuario tiene una fila identificada por `user_id`, con `started_at`, `target_at` y `updated_at` como `timestamptz`. Las políticas RLS existentes deben permitir al usuario leer, insertar y actualizar su propia fila.

Cada guardado verifica el usuario con `auth.getUser()` y hace un upsert con `onConflict: 'user_id'`. `started_at` y `updated_at` se reinician al instante en que se pulsa Guardar; `target_at` recibe la fecha seleccionada como ISO con zona horaria. No se persisten fechas en el navegador.

El mismo formulario carga y guarda `title_text`, `start_label`, `end_label` y `message_text` junto con la fecha. Los textos son obligatorios, se recortan los espacios iniciales/finales y se admiten hasta 60, 40, 40 y 160 caracteres, respectivamente. Los usuarios sin registro comienzan con los valores predeterminados de la tabla como propuesta del formulario. El contador muestra los textos recuperados de Supabase; al llegar al objetivo mantiene «Llegó el momento.».

El progreso se calcula cada segundo como `(ahora - started_at) / (target_at - started_at)`, limitado a 0–100%. Al llegar al objetivo, el contador queda en cero y la barra roja y completa. Si no existe una fila, se ofrece Definir fecha; los errores de lectura permiten reintentar.

La conversión utiliza `America/Santiago`, independientemente de la zona del navegador, y considera el horario de verano. Las horas inexistentes durante el cambio de horario se rechazan; si una hora se repite en otoño, se utiliza su primera ocurrencia. Las fechas recuperadas se muestran en Santiago.

Esta versión incorpora login, sesión persistente y logout con Supabase Auth. No incluye registro ni recuperación de contraseña. Usa fuentes del sistema.

## Configuración de Supabase

Introduce la URL del proyecto y su clave publicable en `.env.local`, en la raíz:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` está excluido de Git. Usa únicamente la clave publicable; nunca claves privadas. El cliente reutilizable está en `app/lib/supabase.ts`, mediante `getSupabaseClient()`. Se inicializa en el navegador y deja que Supabase gestione la persistencia y renovación de tokens. La aplicación no guarda tokens manualmente.

`AuthProvider` comprueba la sesión inicial y escucha los cambios de autenticación. `SessionGate` oculta el formulario o el contenido protegido mientras comprueba la sesión y redirige con `router.replace`. La protección funciona en el cliente y conserva la exportación estática. Las consultas utilizan la clave publicable, el usuario autenticado y las políticas RLS de Supabase.

`LoadingLogo` (`app/components/loading-logo.tsx`) reutiliza `public/cv-logo.png` en las comprobaciones de sesión, consultas iniciales y operaciones. Login, guardado y logout muestran un overlay oscuro sobre la pantalla actual. `LoadingLink` utiliza el estado pendiente real de Next.js para mostrarlo durante navegaciones que lo necesiten, sin retrasos artificiales. La rotación es horaria, lineal, de 1,4 segundos por vuelta y se desactiva con `prefers-reduced-motion`. Los estados se anuncian mediante etiquetas accesibles sin texto visible.

Después de cambiar las variables, reinicia el servidor de desarrollo. Para la exportación estática, define también ambas variables en el entorno que ejecuta el build de GitHub Pages: Next.js incorpora sus valores públicos durante la compilación, por lo que cualquier cambio requiere volver a construir y publicar.

## Probar autenticación

Utiliza un usuario existente en Supabase Auth; esta app no crea usuarios.

1. Sin sesión, abre `/countdown` y `/settings` directamente: deben mostrar la comprobación y volver a `/`.
2. Introduce una contraseña incorrecta: debe aparecer un error en español y habilitarse nuevamente el botón.
3. Inicia sesión con credenciales válidas: debe abrirse `/countdown`.
4. Recarga, cierra y vuelve a abrir el navegador en el mismo perfil. La sesión debe recuperarse o renovarse; abrir `/` debe llevar al contador sin mostrar el formulario.
5. Pulsa Cerrar sesión y vuelve a abrir ambas rutas protegidas, incluso con el botón Atrás: deben volver al login. También comprueba otra pestaña abierta del mismo sitio.

## Probar fechas

1. Con un usuario sin fila, verifica el estado vacío y el botón Definir fecha.
2. Prueba campos vacíos, una fecha pasada y una hora igual al momento actual: no deben guardarse.
3. Guarda una fecha futura y comprueba en Supabase la fila y los timestamps ISO. Recarga el contador y abre Configurar fecha: los valores deben recuperarse en horario de Santiago.
4. Cambia el objetivo: debe mantenerse una sola fila para el usuario y reiniciarse `started_at`, `updated_at` y la barra.
5. Elige el próximo minuto y espera hasta el objetivo: contador cero, barra roja al 100% y Llegó el momento.
6. Corta la conexión y comprueba los errores y Reintentar. Prueba otro usuario para verificar el aislamiento de las filas mediante RLS.
7. Personaliza los cuatro textos, guarda y recarga ambas pantallas: deben conservarse. Prueba textos vacíos o con solo espacios, espacios en los extremos y valores cerca del máximo en móvil y escritorio.

Las pruebas automatizadas usan respuestas de Auth y de la tabla simuladas, sin contactar Supabase ni utilizar credenciales reales. Incluyen persistencia, upsert, errores, validación de fechas, cambios de horario de Santiago, límites del progreso y HTML inicial sin contenido protegido:

```sh
node --test tests/*.test.mjs
```

## Verificación y exportación

```sh
npm run lint
npm run build
```

El build exporta las páginas estáticas a `out/`, con rutas que terminan en `/`. No se requiere un servidor de Next.js en producción.

Para publicar más adelante en GitHub Pages bajo una ruta de repositorio, configura `NEXT_PUBLIC_BASE_PATH` antes del build. Por ejemplo, en PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH = '/countdown-vault'
npm run build
```

Para un dominio propio o un sitio en la raíz, omite esa variable.

## GitHub Pages

`.github/workflows/deploy-pages.yml` publica automáticamente cada push a `main` y permite ejecución manual desde Actions. Usa Node.js 24, `npm ci`, lint, build estático, pruebas y las acciones oficiales de GitHub Pages para subir `out/` y desplegar en el environment `github-pages`.

GitHub Pages debe tener GitHub Actions como fuente. En Settings → Secrets and variables → Actions → Variables, configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. El workflow lee exclusivamente estas Repository Variables y establece `NEXT_PUBLIC_BASE_PATH=/countdown-vault` durante el build, reutilizando la configuración existente de Next.js.

La URL del sitio es `https://badbryan01.github.io/countdown-vault/`. Revisa en Actions que los jobs `build` y `deploy` terminen correctamente. `.env.local` permanece ignorado y no se usa en el runner.
