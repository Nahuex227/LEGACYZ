/* ==========================================================================
   LEGACYZ — store.js
   CAPA DE DATOS. Es el archivo más importante del sistema.

   REGLA DEL PROYECTO: ninguna página lee ni escribe datos por su cuenta.
   Todas le piden la información a LZ.store. Ninguna sabe si los datos
   vienen de internet o del navegador. Gracias a eso, cambiar el origen de
   los datos es cambiar UNA línea en config.js, y no se toca ninguna página.

        páginas HTML  →  LZ.store  →  Supabase (la base de datos)
                                   →  espejo guardado en el navegador
                                   →  data.js (contenido de fábrica)

   LAS TRES FUENTES, EN ORDEN
   Cuando el modo es 'auto' y se pide una lista, se intenta en este orden:
     1. Supabase. Si contesta, además se guarda una copia (el "espejo").
     2. El espejo, si Supabase no contestó a tiempo o hubo un error.
     3. data.js, si nunca hubo espejo (por ejemplo, una computadora nueva
        sin internet).
   Por eso el sitio nunca se ve vacío, ni siquiera sin conexión.

   POR QUÉ LA ESCRITURA NO TIENE RED DE CONTENCIÓN
   Leer sin conexión es útil. Guardar sin conexión no: quedaría escrito en
   una computadora y perdido para todas las demás. Cuando no se puede
   guardar, el panel lo dice claramente en vez de fingir que guardó.

   MÉTODOS DISPONIBLES (todos devuelven una promesa)
     LZ.store.listar(coleccion)              → array de registros
     LZ.store.obtener(coleccion, id)         → un registro
     LZ.store.crear(coleccion, datos)        → registro creado
     LZ.store.actualizar(coleccion, id, dat) → registro actualizado
     LZ.store.eliminar(coleccion, id)        → true
     LZ.store.leerSitio()                    → identidad del sitio
     LZ.store.guardarSitio(datos)            → identidad guardada
     LZ.store.subirFoto(archivo)             → URL de la foto
     LZ.store.metricas()                     → datos rápidos de la portada
     LZ.store.restaurar()                    → vuelve al contenido de fábrica
     LZ.store.estado()                       → informe del origen de datos
     LZ.store.sesion()                       → usuario conectado, o null
     LZ.store.entrar(email, clave)           → inicia sesión
     LZ.store.salir()                        → cierra sesión
   ========================================================================== */

window.LZ = window.LZ || {};

(function () {
  'use strict';

  var cfg = LZ.config;

  /* Bandera: se enciende cuando una lectura tuvo que usar el respaldo.
     El panel de administración la muestra para que se note que el sitio
     está funcionando sin conexión. */
  var usandoRespaldo = false;
  var ultimoMotivo   = '';


  /* ======================================================================
     UTILIDADES COMPARTIDAS
     ====================================================================== */

  /* Copia profunda: evita que una página modifique sin querer los datos
     que están guardados en memoria. */
  function copiar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  /* Ordena una lista según lo que diga config.ordenPor.
     Casi todas las colecciones se ordenan por la columna 'orden';
     los cálculos, por fecha, del más nuevo al más viejo. */
  function ordenar(lista, coleccion) {
    var columna = cfg.ordenPor[coleccion] || 'orden';
    var copia = lista.slice();

    if (columna === 'orden') {
      copia.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    } else {
      copia.sort(function (a, b) { return new Date(b[columna]) - new Date(a[columna]); });
    }
    return copia;
  }

  /* Le pone un límite de tiempo a una promesa.
     Sin esto, una conexión muy lenta dejaría la página esperando para
     siempre y el visitante vería la pantalla vacía. */
  function conLimiteDeTiempo(promesa, ms, queCosa) {
    return new Promise(function (cumplir, fallar) {
      var reloj = setTimeout(function () {
        fallar(new Error(queCosa + ' tardó más de ' + ms + ' ms en responder.'));
      }, ms);

      promesa.then(
        function (v) { clearTimeout(reloj); cumplir(v); },
        function (e) { clearTimeout(reloj); fallar(e); }
      );
    });
  }

  /* ¿Se puede usar el almacenamiento del navegador?
     En modo privado, o abriendo el archivo con ciertas configuraciones,
     el navegador lo bloquea. Preguntamos antes de usarlo. */
  function hayAlmacenamiento() {
    try {
      window.localStorage.setItem('__lz_prueba', '1');
      window.localStorage.removeItem('__lz_prueba');
      return true;
    } catch (e) {
      return false;
    }
  }


  /* ======================================================================
     EL ESPEJO
     Una copia de lo último que contestó la base de datos, guardada en esta
     computadora. Si mañana no hay internet, el sitio muestra esta copia en
     vez de quedarse vacío.
     ====================================================================== */

  var Espejo = {

    leerTodo: function () {
      if (!hayAlmacenamiento()) return null;
      try {
        var crudo = window.localStorage.getItem(cfg.claveEspejo);
        return crudo ? JSON.parse(crudo) : null;
      } catch (e) {
        return null;
      }
    },

    guardarTodo: function (base) {
      if (!hayAlmacenamiento()) return;
      try {
        window.localStorage.setItem(cfg.claveEspejo, JSON.stringify(base));
      } catch (e) {
        /* El espejo es un lujo, no una necesidad: si no entra, se ignora
           en silencio. El sitio sigue funcionando contra la base. */
        console.warn('[LEGACYZ] No entró la copia local:', e.message);
      }
    },

    guardarColeccion: function (coleccion, lista) {
      var base = this.leerTodo() || {};
      base[coleccion] = lista;
      this.guardarTodo(base);
    },

    leerColeccion: function (coleccion) {
      var base = this.leerTodo();
      return base && base[coleccion] ? base[coleccion] : null;
    },

    borrar: function () {
      if (!hayAlmacenamiento()) return;
      try { window.localStorage.removeItem(cfg.claveEspejo); } catch (e) {}
    },

    tamanioKb: function () {
      if (!hayAlmacenamiento()) return 0;
      var t = window.localStorage.getItem(cfg.claveEspejo);
      return t ? Math.round(t.length / 1024) : 0;
    }
  };

  /* De dónde sale el contenido cuando la base no está disponible:
     primero el espejo, y si no hay espejo, el contenido de fábrica. */
  function respaldoDe(coleccion) {
    var delEspejo = Espejo.leerColeccion(coleccion);
    if (delEspejo) return ordenar(copiar(delEspejo), coleccion);

    var deFabrica = LZ.datosIniciales[coleccion];
    return deFabrica ? ordenar(copiar(deFabrica), coleccion) : [];
  }

  function respaldoDelSitio() {
    var base = Espejo.leerTodo();
    if (base && base.sitio) return copiar(base.sitio);
    return copiar(LZ.datosIniciales.sitio);
  }


  /* ======================================================================
     BACKEND 1 — EL NAVEGADOR (localStorage)
     Se usa con backend: 'local', y también cuando el modo 'auto' no logra
     conectarse. Funciona con doble clic en index.html, sin internet.
     ====================================================================== */

  var Local = {

    /* Si el navegador bloquea el almacenamiento se usa esta copia en
       memoria: se pierde al recargar, pero el sitio no se rompe. */
    memoria: null,

    base: function () {
      if (this.memoria) return this.memoria;

      var crudo = hayAlmacenamiento() ? window.localStorage.getItem(cfg.claveLocal) : null;

      if (crudo) {
        try {
          this.memoria = JSON.parse(crudo);
          return this.memoria;
        } catch (e) {
          console.warn('[LEGACYZ] Datos guardados ilegibles. Se restauran los de fábrica.');
        }
      }

      this.memoria = copiar(LZ.datosIniciales);
      this.guardar();
      return this.memoria;
    },

    guardar: function () {
      if (!hayAlmacenamiento()) return;
      try {
        window.localStorage.setItem(cfg.claveLocal, JSON.stringify(this.memoria));
      } catch (e) {
        throw new Error('El almacenamiento del navegador está lleno. Borrá alguna foto e intentá de nuevo.');
      }
    },

    /* En la base de datos los id los pone Postgres. Acá los ponemos a mano:
       el siguiente id es el mayor que haya más uno. */
    proximoId: function (lista) {
      var max = 0;
      lista.forEach(function (r) { if (Number(r.id) > max) max = Number(r.id); });
      return max + 1;
    },

    listar: function (coleccion) {
      var base = this.base();
      return Promise.resolve(ordenar(copiar(base[coleccion] || []), coleccion));
    },

    crear: function (coleccion, datos) {
      var base = this.base();
      if (!base[coleccion]) base[coleccion] = [];

      var registro = copiar(datos);
      registro.id = this.proximoId(base[coleccion]);
      if (registro.orden === undefined) registro.orden = base[coleccion].length + 1;

      base[coleccion].push(registro);
      this.guardar();
      return Promise.resolve(copiar(registro));
    },

    actualizar: function (coleccion, id, cambios) {
      var base = this.base();
      var encontrado = null;

      (base[coleccion] || []).forEach(function (r) {
        if (String(r.id) === String(id)) {
          Object.keys(cambios).forEach(function (k) { r[k] = cambios[k]; });
          encontrado = r;
        }
      });

      this.guardar();
      return Promise.resolve(encontrado ? copiar(encontrado) : null);
    },

    eliminar: function (coleccion, id) {
      var base = this.base();
      base[coleccion] = (base[coleccion] || []).filter(function (r) {
        return String(r.id) !== String(id);
      });
      this.guardar();
      return Promise.resolve(true);
    },

    leerSitio: function () {
      return Promise.resolve(copiar(this.base().sitio));
    },

    guardarSitio: function (datos) {
      var base = this.base();
      base.sitio = copiar(datos);
      this.guardar();
      return Promise.resolve(copiar(base.sitio));
    },

    /* Sin base de datos, la foto se guarda como texto (data URL) dentro
       del navegador. Con Supabase pasa a ser una URL pública de Storage. */
    subirFoto: function (archivo) {
      return LZ.store.comprimirImagen(archivo);
    },

    restaurar: function () {
      this.memoria = copiar(LZ.datosIniciales);
      this.guardar();
      return Promise.resolve(true);
    },

    espacioKb: function () {
      if (!hayAlmacenamiento()) return 0;
      var t = window.localStorage.getItem(cfg.claveLocal);
      return t ? Math.round(t.length / 1024) : 0;
    }
  };


  /* ======================================================================
     BACKEND 2 — SUPABASE (la base de datos en internet)
     Las tablas y columnas son las de supabase.sql.
     ====================================================================== */

  var Supa = {

    cliente: null,

    /* ¿Ya está disponible el SDK? */
    haySDK: function () {
      return !!(window.supabase && window.supabase.createClient);
    },

    /* Espera a que llegue el archivo de Supabase desde internet.
       El <script> del <head> tiene "async", así que puede llegar después
       de que la página ya se dibujó.

       En vez de esperar a ciegas, escuchamos al propio <script>:
         · si avisa "error"  → no hay internet, se sabe al instante y no
                               se hace esperar a nadie;
         · si avisa "load"   → el SDK está listo, aunque haya tardado;
         · el reloj de config.tiempos.sdk queda solo como último recurso,
           por si el evento ya pasó antes de que llegáramos a escucharlo. */
    esperarSDK: function () {
      var yo = this;
      if (yo.haySDK()) return Promise.resolve(true);

      return new Promise(function (listo) {
        var resuelto = false;

        function terminar(valor) {
          if (resuelto) return;
          resuelto = true;
          listo(valor);
        }

        var etiqueta = document.querySelector('script[src*="supabase-js"]');

        if (etiqueta) {
          etiqueta.addEventListener('load',  function () { terminar(yo.haySDK()); });
          etiqueta.addEventListener('error', function () { terminar(false); });
        }

        setTimeout(function () { terminar(yo.haySDK()); }, cfg.tiempos.sdk);
      });
    },

    /* Prepara el cliente. Devuelve una promesa que da true si quedó listo. */
    iniciar: function () {
      var yo = this;

      if (yo.cliente) return Promise.resolve(true);

      if (!cfg.supabase.url || !cfg.supabase.clavePublica) {
        ultimoMotivo = 'Faltan la dirección o la clave en config.js.';
        return Promise.resolve(false);
      }

      return yo.esperarSDK().then(function (llego) {
        if (!llego) {
          ultimoMotivo = 'No se pudo cargar el archivo de Supabase (¿sin internet?).';
          return false;
        }
        yo.cliente = window.supabase.createClient(
          cfg.supabase.url,
          cfg.supabase.clavePublica
        );
        return true;
      });
    },

    tabla: function (coleccion) {
      return cfg.tablas[coleccion] || coleccion;
    },

    listar: function (coleccion) {
      var columna = cfg.ordenPor[coleccion] || 'orden';

      return this.cliente
        .from(this.tabla(coleccion))
        .select('*')
        .order(columna, { ascending: columna === 'orden' })
        .then(function (r) {
          if (r.error) throw r.error;
          return r.data || [];
        });
    },

    crear: function (coleccion, datos) {
      return this.cliente
        .from(this.tabla(coleccion))
        .insert(datos)
        .select()
        .single()
        .then(function (r) {
          if (r.error) throw r.error;
          return r.data;
        });
    },

    actualizar: function (coleccion, id, cambios) {
      return this.cliente
        .from(this.tabla(coleccion))
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
        .then(function (r) {
          if (r.error) throw r.error;
          return r.data;
        });
    },

    eliminar: function (coleccion, id) {
      return this.cliente
        .from(this.tabla(coleccion))
        .delete()
        .eq('id', id)
        .then(function (r) {
          if (r.error) throw r.error;
          return true;
        });
    },

    /* La tabla "sitio" tiene una sola fila, con id = 1 */
    leerSitio: function () {
      return this.cliente
        .from(cfg.tablas.sitio)
        .select('*')
        .eq('id', 1)
        .single()
        .then(function (r) {
          if (r.error) throw r.error;
          return r.data;
        });
    },

    guardarSitio: function (datos) {
      var fila = Object.assign({}, datos, { id: 1 });

      return this.cliente
        .from(cfg.tablas.sitio)
        .upsert(fila)
        .select()
        .single()
        .then(function (r) {
          if (r.error) throw r.error;
          return r.data;
        });
    },

    /* Sube la foto a Storage y devuelve su dirección pública */
    subirFoto: function (archivo) {
      var db = this.cliente;
      var bucket = cfg.bucketFotos;

      /* El nombre lleva la hora para que dos fotos con el mismo nombre no
         se pisen, y se limpian los caracteres raros. */
      var nombre = Date.now() + '-' + archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

      return db.storage.from(bucket)
        .upload(nombre, archivo, { cacheControl: '3600', upsert: false })
        .then(function (r) {
          if (r.error) throw r.error;
          return db.storage.from(bucket).getPublicUrl(nombre).data.publicUrl;
        });
    },

    restaurar: function () {
      return Promise.reject(new Error(
        'Restaurar el contenido de fábrica solo funciona en modo local. ' +
        'Con la base de datos conectada, volvé a ejecutar supabase.sql.'
      ));
    }
  };


  /* ======================================================================
     ELEGIR EL BACKEND
     Se resuelve una sola vez por página y queda guardado, para no repetir
     la espera del SDK en cada consulta.
     ====================================================================== */

  var eleccion = null;

  /* true = el modo 'auto' está usando el navegador PORQUE no pudo conectarse,
     y no porque config.js diga 'local'. La diferencia importa: en ese caso
     no se puede guardar nada (ver exigirConexion más abajo). */
  var cayoPorFalla = false;

  function backendActivo() {
    /* Si antes no se pudo conectar pero el SDK ya llegó —una conexión lenta,
       o el wifi que volvió— se vuelve a intentar en lugar de quedar atrapado
       en modo local por el resto de la visita. */
    if (eleccion && cayoPorFalla && Supa.haySDK()) {
      eleccion = null;
      cayoPorFalla = false;
      usandoRespaldo = false;
    }

    if (eleccion) return eleccion;

    if (cfg.backend === 'local') {
      eleccion = Promise.resolve(Local);
      return eleccion;
    }

    eleccion = Supa.iniciar().then(function (listo) {
      if (listo) return Supa;

      /* Modo estricto: si no se puede conectar, se avisa con un error.
         Modo 'auto': se sigue mostrando lo que haya guardado. */
      if (cfg.backend === 'supabase') {
        throw new Error('No se pudo conectar con la base de datos. ' + ultimoMotivo);
      }

      cayoPorFalla = true;
      usandoRespaldo = true;
      console.warn('[LEGACYZ] Sin base de datos. ' + ultimoMotivo + ' Se muestra el contenido guardado.');
      return Local;
    });

    return eleccion;
  }

  /* Se llama cuando la conexión se pudo establecer después de haber
     fallado: deja de usarse el respaldo y se vuelve a la base de datos. */
  function rehabilitarConexion() {
    if (!cayoPorFalla) return;
    eleccion = Promise.resolve(Supa);
    cayoPorFalla = false;
    usandoRespaldo = false;
    ultimoMotivo = '';
    console.info('[LEGACYZ] Conexión con la base de datos recuperada.');
  }

  /* GUARDIA DE ESCRITURA.
     Leer sin conexión es útil: se muestra la última copia. Guardar sin
     conexión no lo es: quedaría escrito en esta computadora y perdido para
     todas las demás, y la persona creería que guardó en la base. Cuando el
     modo es 'auto' y la conexión falló, guardar tiene que fallar a la vista. */
  function exigirConexion(backend) {
    if (backend !== Local || !cayoPorFalla) return;

    throw new Error(
      'Sin conexión con la base de datos: no se puede guardar ahora. ' +
      'El sitio sigue mostrando la última copia guardada. Probá de nuevo ' +
      'cuando vuelva internet.'
    );
  }

  /* Se llama cuando una consulta falló y hubo que usar el respaldo */
  function anotarCaida(error) {
    usandoRespaldo = true;
    ultimoMotivo = error && error.message ? error.message : 'Error de conexión.';
    console.warn('[LEGACYZ] Lectura desde el respaldo. Motivo:', ultimoMotivo);
  }

  /* Un error de escritura siempre se muestra: nunca se guarda "a medias" */
  function errorAlGuardar(error) {
    console.error('[LEGACYZ] No se pudo guardar:', error);

    if (error && (error.code === '42501' || /row-level security/i.test(error.message || ''))) {
      throw new Error('No tenés permiso para guardar esto. Iniciá sesión en el panel.');
    }
    throw error;
  }


  /* ======================================================================
     FACHADA PÚBLICA
     Es lo único que usan las páginas. Todo lo de arriba es interno.
     ====================================================================== */

  LZ.store = {

    /* ---------- LECTURA (con las tres fuentes) ---------- */

    listar: function (coleccion) {
      return backendActivo().then(function (backend) {
        if (backend !== Supa) return Local.listar(coleccion);

        return conLimiteDeTiempo(Supa.listar(coleccion), cfg.tiempos.red, 'La base de datos')
          .then(function (lista) {
            Espejo.guardarColeccion(coleccion, lista);   // refresca el espejo
            return lista;
          })
          .catch(function (error) {
            if (cfg.backend === 'supabase') throw error;  // modo estricto
            anotarCaida(error);
            return respaldoDe(coleccion);
          });
      });
    },

    obtener: function (coleccion, id) {
      return this.listar(coleccion).then(function (lista) {
        var encontrado = null;
        lista.forEach(function (r) { if (String(r.id) === String(id)) encontrado = r; });
        return encontrado;
      });
    },

    leerSitio: function () {
      return backendActivo().then(function (backend) {
        if (backend !== Supa) return Local.leerSitio();

        return conLimiteDeTiempo(Supa.leerSitio(), cfg.tiempos.red, 'La base de datos')
          .then(function (sitio) {
            var base = Espejo.leerTodo() || {};
            base.sitio = sitio;
            Espejo.guardarTodo(base);
            return sitio;
          })
          .catch(function (error) {
            if (cfg.backend === 'supabase') throw error;
            anotarCaida(error);
            return respaldoDelSitio();
          });
      }).catch(function () {
        /* Última red: la marca del sitio se muestra igual pase lo que pase */
        return respaldoDelSitio();
      });
    },

    /* Los datos rápidos de la portada: si la tabla está vacía, se usan
       los de fábrica para que la portada nunca quede sin números. */
    metricas: function () {
      return this.listar('metricas').then(function (lista) {
        return lista.length ? lista : copiar(LZ.datosIniciales.metricas);
      });
    },

    /* ---------- ESCRITURA (sin red de contención, a propósito) ---------- */

    crear: function (coleccion, datos) {
      return backendActivo().then(function (backend) {
        exigirConexion(backend);
        return backend.crear(coleccion, datos);
      }).then(function (fila) {
        Espejo.borrar();   // el espejo quedó viejo: se rearma en la próxima lectura
        return fila;
      }).catch(errorAlGuardar);
    },

    actualizar: function (coleccion, id, cambios) {
      return backendActivo().then(function (backend) {
        exigirConexion(backend);
        return backend.actualizar(coleccion, id, cambios);
      }).then(function (fila) {
        Espejo.borrar();
        return fila;
      }).catch(errorAlGuardar);
    },

    eliminar: function (coleccion, id) {
      return backendActivo().then(function (backend) {
        exigirConexion(backend);
        return backend.eliminar(coleccion, id);
      }).then(function (ok) {
        Espejo.borrar();
        return ok;
      }).catch(errorAlGuardar);
    },

    guardarSitio: function (datos) {
      return backendActivo().then(function (backend) {
        exigirConexion(backend);
        return backend.guardarSitio(datos);
      }).then(function (fila) {
        Espejo.borrar();
        return fila;
      }).catch(errorAlGuardar);
    },

    subirFoto: function (archivo) {
      return backendActivo().then(function (backend) {
        exigirConexion(backend);
        return backend.subirFoto(archivo);
      }).catch(errorAlGuardar);
    },

    restaurar: function () {
      return backendActivo().then(function (backend) {
        return backend.restaurar();
      });
    },

    /* ---------- SESIÓN (solo con la base de datos conectada) ---------- */

    /* ¿Este modo necesita que alguien inicie sesión para editar? */
    requiereSesion: function () {
      return cfg.backend !== 'local';
    },

    sesion: function () {
      return backendActivo().then(function (backend) {
        if (backend !== Supa) return null;

        return Supa.cliente.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          return s ? { email: s.user.email, id: s.user.id } : null;
        });
      }).catch(function () {
        return null;
      });
    },

    /* ¿Se puede iniciar sesión ahora mismo? Devuelve { puede, motivo }.
       El panel lo usa para avisar ANTES de que la persona escriba la
       contraseña, en vez de dejar que falle al apretar Entrar. */
    puedeIniciarSesion: function () {
      if (cfg.backend === 'local') {
        return Promise.resolve({
          puede: false,
          motivo: 'El sitio está configurado en modo local (config.js): no usa la base de datos.'
        });
      }

      return Supa.iniciar().then(function (listo) {
        if (listo) { rehabilitarConexion(); return { puede: true, motivo: '' }; }
        return {
          puede: false,
          motivo: 'No hay conexión con la base de datos. ' + ultimoMotivo
        };
      });
    },

    entrar: function (email, clave) {
      if (cfg.backend === 'local') {
        return Promise.reject(new Error(
          'El sitio está configurado en modo local (config.js): no hay sesión que iniciar.'
        ));
      }

      /* Se reintenta la conexión en este momento: el archivo de Supabase
         puede haber llegado tarde y no tiene sentido rechazar el login por
         una demora que ya pasó. */
      return Supa.iniciar().then(function (listo) {
        if (!listo) {
          throw new Error('No hay conexión con la base de datos, así que no se puede iniciar sesión. ' + ultimoMotivo);
        }
        rehabilitarConexion();
        return Supa.cliente.auth.signInWithPassword({ email: email, password: clave });
      }).then(function (r) {
        if (r.error) {
          /* Mensajes en castellano para los dos casos habituales */
          if (/invalid login credentials/i.test(r.error.message)) {
            throw new Error('El email o la contraseña no son correctos.');
          }
          if (/email not confirmed/i.test(r.error.message)) {
            throw new Error('La cuenta todavía no está confirmada.');
          }
          throw new Error(r.error.message);
        }
        return { email: r.data.user.email, id: r.data.user.id };
      });
    },

    salir: function () {
      if (!Supa.cliente) return Promise.resolve(true);
      return Supa.cliente.auth.signOut().then(function () { return true; });
    },

    /* ---------- INFORME DEL ORIGEN DE LOS DATOS ---------- */

    estado: function () {
      return backendActivo().then(function (backend) {
        var conectado = backend === Supa && !usandoRespaldo;

        return {
          modo:       cfg.backend,
          backend:    backend === Supa ? 'supabase' : 'local',
          conectado:  conectado,
          respaldo:   usandoRespaldo,
          motivo:     ultimoMotivo,
          etiqueta:   conectado
                        ? 'Base de datos conectada'
                        : (usandoRespaldo
                            ? 'Sin conexión — mostrando la copia guardada'
                            : 'Datos guardados en este navegador'),
          espacioKb:  backend === Supa ? Espejo.tamanioKb() : Local.espacioKb()
        };
      }).catch(function (error) {
        return {
          modo: cfg.backend, backend: 'local', conectado: false, respaldo: true,
          motivo: error.message, etiqueta: 'Error de conexión', espacioKb: 0
        };
      });
    },

    /* ---------- ACHICAR UNA IMAGEN ANTES DE GUARDARLA ----------
       Una foto de celular pesa varios megabytes. Achicarla antes de
       subirla hace que la galería cargue mucho más rápido, y en modo
       local es lo único que permite que entre en el navegador.
       ------------------------------------------------------------------ */

    comprimirImagen: function (archivo) {
      return new Promise(function (cumplir, fallar) {
        if (!archivo || !/^image\//.test(archivo.type)) {
          fallar(new Error('El archivo elegido no es una imagen.'));
          return;
        }

        var lector = new FileReader();
        lector.onerror = function () { fallar(new Error('No se pudo leer el archivo.')); };

        lector.onload = function () {
          var img = new Image();
          img.onerror = function () { fallar(new Error('La imagen está dañada.')); };

          img.onload = function () {
            /* Se achica solo si es más ancha que el máximo: nunca se agranda */
            var escala = Math.min(1, cfg.foto.anchoMax / img.width);

            var lienzo = document.createElement('canvas');
            lienzo.width  = Math.round(img.width * escala);
            lienzo.height = Math.round(img.height * escala);
            lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);

            cumplir(lienzo.toDataURL('image/jpeg', cfg.foto.calidad));
          };

          img.src = lector.result;
        };

        lector.readAsDataURL(archivo);
      });
    }
  };

})();
