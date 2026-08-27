/* ==========================================================================
   LEGACYZ — config.js
   Configuración central del sistema.

   Todo lo que se cambia una sola vez (el modo de datos, las claves, los
   nombres de las tablas) vive acá. Ningún otro archivo tiene estos valores
   escritos adentro: si algo hay que cambiar, se cambia en este archivo.

   ORDEN DE CARGA: este archivo va SIEMPRE primero, antes que data.js,
   store.js, ui.js y script.js.
   ========================================================================== */

/* Espacio de nombres global del proyecto. En lugar de crear decenas de
   variables sueltas en la página, todo el proyecto cuelga de LZ:
   LZ.config, LZ.datosIniciales, LZ.store, LZ.ui. Así no chocan nombres. */
window.LZ = window.LZ || {};

LZ.config = {

  /* ====================================================================
     MODO DE DATOS  ← CAMBIÁ ESTO PARA elegir de dónde salen los datos

     'auto'      Intenta la base de datos (Supabase). Si no hay internet,
                 si el navegador no pudo bajar el SDK o si la consulta
                 tarda demasiado, muestra el contenido guardado y sigue
                 funcionando igual. ES EL MODO RECOMENDADO.

     'supabase'  Solo base de datos, sin red de contención. Si algo falla,
                 falla a la vista. Sirve para darse cuenta de que hay un
                 problema de conexión en vez de que pase desapercibido.

     'local'     No toca internet. Todo se guarda en este navegador
                 (localStorage). Sirve para trabajar sin conexión o para
                 mostrar el sitio sin depender de la base.
     ==================================================================== */
  backend: 'auto',

  /* --------------------------------------------------------------------
     CONEXIÓN A LA BASE DE DATOS

     La clave de abajo es PÚBLICA: está pensada para ir escrita en el
     código de la página, igual que la dirección del sitio. Lo que impide
     que alguien borre el contenido con esta clave no es esconderla, sino
     las políticas de seguridad de la base (RLS), que solo permiten
     escribir con la sesión iniciada.

     NUNCA pongas acá la clave "service_role" ni la "secret": esas sí dan
     permiso total y no deben salir del panel de Supabase.
     -------------------------------------------------------------------- */
  supabase: {
    url:          'https://hrrqpmcscvzeaowbinrt.supabase.co',
    clavePublica: 'sb_publishable_CxDkgoeurqMztdRIGs_4nQ_73WmDfzS'
  },

  /* --------------------------------------------------------------------
     TIEMPOS DE ESPERA (en milisegundos)

     Son los dos relojes que hacen posible el modo 'auto'. Sin ellos, una
     conexión muy lenta dejaría la página esperando para siempre.

     sdk  cuánto se espera a que llegue el archivo de Supabase desde
          internet. Si no llegó, se asume que no hay conexión.
     red  cuánto se espera la respuesta de una consulta a la base.
     -------------------------------------------------------------------- */
  tiempos: {
    sdk: 2000,
    red: 4000
  },

  /* Nombres de las tablas en la base de datos.
     Coinciden con los del archivo supabase.sql. */
  tablas: {
    sitio:       'sitio',
    metricas:    'metricas',
    equipo:      'equipo',
    componentes: 'componentes',
    galeria:     'galeria',
    bitacora:    'bitacora',
    factores:    'factores',
    calculos:    'calculos'
  },

  /* Columna por la que se ordena cada colección al leerla.
     Si una colección no figura acá, se ordena por 'orden'. */
  ordenPor: {
    calculos: 'fecha'
  },

  /* Carpeta de Supabase Storage donde se suben las fotos del proyecto */
  bucketFotos: 'fotos',

  /* --------------------------------------------------------------------
     CLAVES DEL NAVEGADOR
     Son los nombres con los que el sitio guarda cosas en esta computadora.
     Subir el número de versión (v1 → v2) fuerza a empezar de cero.
     -------------------------------------------------------------------- */
  claveLocal:  'legacyz.datos.v1',    // contenido en modo 'local'
  claveEspejo: 'legacyz.espejo.v1',   // copia de lo último que vino de la base
  claveTema:   'legacyz.tema',        // tema claro u oscuro

  /* Las fotos se achican antes de subirlas: cargan más rápido y ocupan
     menos lugar. anchoMax en píxeles, calidad de 0 a 1. */
  foto: { anchoMax: 1200, calidad: 0.72 }
};
