# LEGACYZ — Sitio del proyecto

**Calculadora de Requerimiento de Proteína** · LEGACYZ · 2026

Sitio informativo y funcional del proyecto. Se abre haciendo **doble clic en
`index.html`**: no necesita servidor, ni instalación, ni programas aparte.

---

## Las nueve páginas

| Archivo | Qué contiene |
|---|---|
| `index.html` | Portada: carrusel, presentación, accesos y datos rápidos |
| `proyecto.html` | Problema, funcionamiento, factores, dificultades y aprendizajes |
| `calculadora.html` | Calculadora web funcional, con historial |
| `simulador.html` | Simulador del dispositivo: pantalla LCD 16×2 y teclado 4×4 |
| `tecnica.html` | Componentes, conexiones pin por pin, librerías y código completo |
| `galeria.html` | Galería con filtros por categoría y visor ampliado |
| `bitacora.html` | Línea de tiempo del proceso de trabajo |
| `equipo.html` | Integrantes, roles y reflexión grupal |
| `admin.html` | Panel para editar todo el contenido sin tocar el código |

## Cómo están organizados los archivos

Las nueve páginas quedan en la raíz, porque son las direcciones públicas del
sitio (`/calculadora.html`, `/galeria.html`, …). Todo lo demás está agrupado
por tipo:

```
LEGACYZ/
├── index.html            las nueve páginas, en la raíz
├── proyecto.html
├── …
├── assets/
│   ├── css/
│   │   └── estilos.css   toda la apariencia
│   ├── js/
│   │   ├── nucleo/       lo que cargan las nueve páginas
│   │   └── paginas/      lo que carga una sola página
│   └── img/              logos
├── db/
│   ├── supabase.sql      la base entera: tablas, seguridad y contenido
│   └── legacyz-contenido.json   respaldo exportado desde el panel
└── README.md
```

| Archivo | Responsabilidad |
|---|---|
| `assets/css/estilos.css` | Toda la apariencia. **Los colores están en el bloque `:root` del inicio** |
| `assets/js/nucleo/config.js` | Configuración: modo de datos, claves, nombres de tablas |
| `assets/js/nucleo/data.js` | Contenido de fábrica (la "semilla") |
| `assets/js/nucleo/store.js` | **Capa de datos.** Única puerta de acceso a la información |
| `assets/js/nucleo/ui.js` | Utilidades de interfaz que se repiten en varias páginas |
| `assets/js/nucleo/script.js` | Arranque general: tema, menú, carrusel, listas de contenido |
| `assets/js/paginas/calculadora.js` | Lógica de la calculadora web |
| `assets/js/paginas/simulador.js` | Máquina de estados del dispositivo simulado |
| `assets/js/paginas/admin.js` | Panel de administración y pantalla de acceso |
| `db/supabase.sql` | Base de datos completa: tablas, seguridad y contenido inicial |
| `assets/img/logo.png` · `logo-completo.png` | Logo del proyecto |

El sitio sigue sin necesitar compilarse ni instalar nada: son archivos
estáticos y las rutas son relativas, así que funciona igual abierto desde el
disco o publicado en un servidor.

---

## Cómo está organizado el sistema

Ninguna página lee ni escribe datos por su cuenta. **Todas le piden la
información a `LZ.store`**, que está en `store.js`:

```
páginas HTML  →  LZ.store  →  1. Supabase (la base de datos en internet)
                           →  2. copia guardada en este navegador
                           →  3. data.js (contenido de fábrica)
```

Se intenta en ese orden. Si no hay internet, el sitio muestra la copia
guardada; y si nunca la hubo, muestra el contenido de `data.js`. **Por eso el
sitio nunca se ve vacío, ni siquiera en una computadora nueva y sin conexión.**

Como las páginas no saben de dónde vienen los datos, cambiar el origen es
cambiar **una línea** en `config.js` y no tocar ninguna página.

### Por qué guardar sí necesita conexión

Leer sin conexión es útil. Guardar sin conexión no: quedaría escrito en una
sola computadora y perdido para todas las demás, y quien lo hizo creería que
guardó en la base. Por eso, cuando no hay conexión, el panel **avisa que no
pudo guardar** en vez de fingir que guardó.

---

## Editar el contenido

Abrir `admin.html` e iniciar sesión. Desde ahí se cambian la marca y el
slogan, los integrantes, los componentes, las fotos de la galería, la bitácora
y los factores de proteína. Los cambios aparecen en las nueve páginas.

El botón **Descargar copia** (sección Datos) guarda todo el contenido en un
archivo JSON. Sirve de respaldo y también para actualizar `data.js`, que es lo
que ve el sitio cuando no hay internet.

### Cambiar los colores

En `estilos.css`, bloque `:root` del inicio. Ahí están el negro, el dorado y
los grises. El tema claro se define un poco más abajo, en `[data-tema="claro"]`.

---

## La base de datos (Supabase)

Ya está conectada y funcionando. La configuración vive en `config.js`.

### El modo de datos

En `config.js`, la línea `backend` acepta tres valores:

- **`'auto'`** — el que está puesto. Usa la base de datos y, si no puede
  llegar, muestra la copia guardada. Es el recomendado.
- **`'supabase'`** — solo base de datos, sin red de contención. Si algo falla,
  falla a la vista. Sirve para darse cuenta de que hay un problema.
- **`'local'`** — no toca internet. Todo se guarda en este navegador.

### Sobre la clave que está en config.js

Es una clave **pública**, pensada para ir escrita en el código de la página.
Lo que impide que alguien borre el contenido con esa clave no es esconderla,
sino las reglas de seguridad de la base (RLS), que solo permiten escribir con
la sesión iniciada. Además, al rol anónimo se le quitó el permiso de escritura
directamente. **Nunca hay que poner en `config.js` la clave `service_role`.**

### Usuarios del panel

Se crean a mano desde el panel de Supabase: *Authentication › Users › Add
user*, con **Auto Confirm User** tildado. La pantalla de `admin.html` solo
permite entrar, no registrarse.

> **Importante:** en *Authentication › Sign In / Providers › Email* tiene que
> estar **desactivado** "Allow new users to sign up". Sin ese paso, cualquiera
> que vea la clave pública podría crearse una cuenta y editar el contenido.

### Rehacer la base desde cero

Ejecutar `supabase.sql` completo en el SQL Editor de Supabase. Crea las 8
tablas, la seguridad, el espacio para las fotos y el contenido inicial.

---

## Publicar el sitio en internet (GitHub Pages)

El sitio ya está preparado: todas las rutas son relativas y está el archivo
`.nojekyll`. Los pasos:

1. Crear un repositorio en GitHub y subir el contenido de esta carpeta.
2. En el repositorio: *Settings › Pages*.
3. En *Source* elegir la rama (`main`) y la carpeta raíz (`/`). Guardar.

A los pocos minutos el sitio queda en línea y `admin.html` se puede usar
también desde el celular.

---

## Notas para la exposición

- El proyecto se explica solo con `proyecto.html` y `simulador.html`: el
  simulador muestra el funcionamiento **aunque el hardware falle**.
- El botón de la esquina superior derecha cambia entre tema oscuro y claro.
- En el simulador se puede usar el teclado real de la computadora: teclas
  `1` a `3` para el objetivo, `0` a `9` para el peso, `A` para confirmar y
  `C` para reiniciar.
- El sitio funciona en celular: la navegación se convierte en un menú.
