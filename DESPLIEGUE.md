# Publicar el sitio

El sitio son archivos estáticos (HTML, CSS y JavaScript) que viven en la
carpeta `LEGACYZ/`. No hace falta pagar hosting: se publica gratis desde este
mismo repositorio con GitHub Pages.

---

## 1. Encender GitHub Pages (una sola vez)

Lo tiene que hacer el dueño del repositorio, porque hace falta permiso de
administrador:

**Settings › Pages › Build and deployment › Source: `GitHub Actions`**

Con eso alcanza. El flujo `.github/workflows/pages.yml` ya está en el repo y
se encarga del resto: cada push a `main` vuelve a publicar el sitio solo.

Mientras no haya dominio propio, el sitio queda en:

```
https://nahuex227.github.io/LEGACYZ/
```

Para ver cómo salió cada publicación: pestaña **Actions** del repositorio.

---

## 2. Comprar el dominio

Para un `.com.ar` el registro es **nic.ar** (el organismo oficial argentino).
Hace falta CUIT o CUIL y Clave Fiscal de AFIP; es la opción más barata.

Para un `.com` sirve cualquier registrador internacional (Namecheap,
Cloudflare, Porkbun, etc.).

No hace falta contratar hosting con el dominio: solo el dominio.

---

## 3. Apuntar el dominio al sitio

En el panel de DNS del dominio hay que cargar estos registros. Son los
servidores de GitHub Pages:

| Tipo  | Nombre | Valor             |
|-------|--------|-------------------|
| A     | `@`    | `185.199.108.153` |
| A     | `@`    | `185.199.109.153` |
| A     | `@`    | `185.199.110.153` |
| A     | `@`    | `185.199.111.153` |
| CNAME | `www`  | `nahuex227.github.io.` |

Los cuatro registros A van todos: son el mismo servicio repetido, para que el
sitio siga en pie si uno se cae.

Después, en el repositorio:

**Settings › Pages › Custom domain** → escribir el dominio y guardar.
Cuando GitHub lo verifique, tildar **Enforce HTTPS** (el certificado lo emite
GitHub gratis; puede tardar unos minutos en aparecer).

Los cambios de DNS pueden demorar en propagarse: normalmente minutos, a veces
hasta 24 horas.

---

## Cómo probar el sitio en la computadora

Abrir `LEGACYZ/index.html` con doble clic alcanza para mirarlo. Para que
funcione igual que publicado conviene levantarlo con un servidor:

```
python3 -m http.server 4173 --directory LEGACYZ
```

y entrar a `http://localhost:4173`.
