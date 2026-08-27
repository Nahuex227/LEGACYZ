/* ==========================================================================
   LEGACYZ — admin.js
   Panel de administración: permite cambiar todo el contenido del sitio sin
   tocar el código.

   CÓMO ESTÁ ORGANIZADA LA PÁGINA
   admin.html tiene tres pantallas y este archivo decide cuál se muestra:
     1. "cargando"  mientras se comprueba si hay una sesión abierta
     2. "acceso"    el formulario de email y contraseña
     3. "panel"     el panel propiamente dicho

   Con backend 'local' no hay nada que proteger (los datos están en esta
   computadora), así que se salta el paso 2 y se va derecho al panel.

   SEGURIDAD
   Esconder el panel es solo comodidad. Lo que de verdad impide que alguien
   edite el sitio son las políticas de la base de datos: sin sesión, la base
   rechaza cualquier escritura aunque se llame directamente. Los usuarios se
   crean a mano desde el panel de Supabase, en Authentication › Users.
   ========================================================================== */

(function () {
  'use strict';

  var ui = LZ.ui;

  /* ======================================================================
     ESQUEMAS
     Definen qué campos tiene cada colección. Gracias a esto, UN SOLO
     formulario sirve para el equipo, los componentes, la galería, la
     bitácora y los factores: no hay cinco formularios repetidos.

     Cada campo tiene:
       k = clave (el nombre de la columna en la base de datos)
       l = etiqueta que ve la persona
       t = tipo de campo (text, number, date, textarea)
       req   = obligatorio
       ancho = 2 para que ocupe las dos columnas del formulario
     ====================================================================== */

  var esquemas = {

    equipo: {
      titulo: 'Integrantes',
      singular: 'integrante',
      campos: [
        { k: 'nombre', l: 'Nombre y apellido', t: 'text', req: true },
        { k: 'rol',    l: 'Rol en el proyecto', t: 'text', req: true },
        { k: 'aporte', l: 'Aporte al proyecto', t: 'textarea', ancho: 2 },
        { k: 'orden',  l: 'Orden', t: 'number' }
      ],
      foto: { k: 'foto', l: 'Foto del integrante' },
      resumen: function (r) { return { titulo: r.nombre, sub: r.rol, img: r.foto }; }
    },

    componentes: {
      titulo: 'Componentes',
      singular: 'componente',
      campos: [
        { k: 'nombre',    l: 'Componente', t: 'text', req: true },
        { k: 'categoria', l: 'Categoría', t: 'text' },
        { k: 'funcion',   l: 'Función en el proyecto', t: 'textarea', ancho: 2 },
        { k: 'pines',     l: 'Pines / conexión', t: 'text' },
        { k: 'cantidad',  l: 'Cantidad', t: 'number' },
        { k: 'orden',     l: 'Orden', t: 'number' }
      ],
      resumen: function (r) {
        return { titulo: r.nombre, sub: r.categoria + ' · ' + r.cantidad + ' unidad(es)' };
      }
    },

    galeria: {
      titulo: 'Galería',
      singular: 'foto',
      campos: [
        { k: 'titulo',      l: 'Título', t: 'text', req: true },
        { k: 'categoria',   l: 'Categoría', t: 'text', req: true, ayuda: 'Construcción, Circuito o Funcionando' },
        { k: 'descripcion', l: 'Descripción', t: 'textarea', ancho: 2 },
        { k: 'orden',       l: 'Orden', t: 'number' }
      ],
      foto: { k: 'url', l: 'Imagen' },
      resumen: function (r) { return { titulo: r.titulo, sub: r.categoria, img: r.url }; }
    },

    bitacora: {
      titulo: 'Bitácora',
      singular: 'entrada',
      campos: [
        { k: 'fecha',  l: 'Fecha', t: 'date', req: true },
        { k: 'titulo', l: 'Título', t: 'text', req: true },
        { k: 'texto',  l: 'Qué pasó', t: 'textarea', ancho: 2 },
        { k: 'orden',  l: 'Orden', t: 'number' }
      ],
      resumen: function (r) { return { titulo: r.titulo, sub: ui.fecha(r.fecha) }; }
    },

    factores: {
      titulo: 'Factores',
      singular: 'factor',
      campos: [
        { k: 'nombre',      l: 'Nombre', t: 'text', req: true },
        { k: 'clave',       l: 'Clave interna', t: 'text' },
        { k: 'descripcion', l: 'Descripción', t: 'textarea', ancho: 2 },
        { k: 'min',         l: 'Mínimo (g/kg)', t: 'number', paso: '0.1' },
        { k: 'max',         l: 'Máximo (g/kg)', t: 'number', paso: '0.1' },
        { k: 'medio',       l: 'Valor usado (g/kg)', t: 'number', paso: '0.01', req: true },
        { k: 'tecla',       l: 'Tecla en el dispositivo', t: 'text', ayuda: 'Vacío si no está en el dispositivo' },
        { k: 'orden',       l: 'Orden', t: 'number' }
      ],
      resumen: function (r) {
        return { titulo: r.nombre, sub: ui.num(r.min) + '–' + ui.num(r.max) + ' g/kg · usa ' + ui.num(r.medio, 2) };
      }
    }
  };

  var panelIniciado = false;


  /* ======================================================================
     ARRANQUE — decidir qué pantalla mostrar
     ====================================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    if (!ui.q('[data-admin="panel"]')) return;

    /* En modo local no hay sesión ni nada que proteger: al panel directo */
    if (!LZ.store.requiereSesion()) {
      abrirPanel(null);
      return;
    }

    prepararLogin();

    LZ.store.sesion().then(function (sesion) {
      if (sesion) { abrirPanel(sesion); return; }

      mostrarPantalla('acceso');

      /* Se avisa ANTES de que la persona escriba la contraseña si el sitio
         no está pudiendo hablar con la base de datos. Es mucho mejor que
         dejarla completar el formulario para que recién ahí falle. */
      LZ.store.puedeIniciarSesion().then(function (r) {
        if (r.puede) return;

        var error = ui.q('[data-admin="acceso-error"]');
        error.textContent = r.motivo;
        error.classList.add('visible');
      });
    });
  });

  /* Muestra una de las tres pantallas y esconde las otras dos */
  function mostrarPantalla(cual) {
    ['cargando', 'acceso', 'panel'].forEach(function (nombre) {
      var el = ui.q('[data-admin="' + nombre + '"]');
      if (el) el.hidden = (nombre !== cual);
    });
  }

  /* ======================================================================
     PANTALLA DE ACCESO
     ====================================================================== */

  function prepararLogin() {
    var form = ui.q('[data-admin="login"]');
    if (!form) return;

    var error = ui.q('[data-admin="acceso-error"]');
    var boton = ui.q('[data-admin="acceso-enviar"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var email = form.querySelector('[name="email"]').value.trim();
      var clave = form.querySelector('[name="clave"]').value;

      error.classList.remove('visible');
      boton.disabled = true;
      boton.textContent = 'Entrando…';

      LZ.store.entrar(email, clave).then(function (sesion) {
        abrirPanel(sesion);
        ui.aviso('Sesión iniciada.');
      }).catch(function (err) {
        error.textContent = err.message || 'No se pudo iniciar sesión.';
        error.classList.add('visible');
      }).then(function () {
        boton.disabled = false;
        boton.textContent = 'Entrar';
      });
    });
  }

  /* ======================================================================
     ABRIR EL PANEL
     ====================================================================== */

  function abrirPanel(sesion) {
    mostrarPantalla('panel');

    /* La barra de sesión solo tiene sentido si hubo login */
    var barra = ui.q('[data-admin="barra-sesion"]');
    if (barra && sesion) {
      barra.hidden = false;
      ui.q('[data-admin="sesion-email"]').textContent = sesion.email;
      var punto = ui.q('[data-admin="estado-barra"]');
      if (punto) punto.className = 'backend-estado conectado';
    }

    prepararSalir();

    /* Si se vuelve a entrar sin recargar, no se arma todo dos veces */
    if (panelIniciado) return;
    panelIniciado = true;

    prepararMenu();
    prepararSitio();
    Object.keys(esquemas).forEach(dibujarColeccion);
    prepararDatos();
  }

  function prepararSalir() {
    var boton = ui.q('[data-admin="salir"]');
    if (!boton || boton.dataset.listo) return;
    boton.dataset.listo = '1';

    boton.addEventListener('click', function () {
      LZ.store.salir().then(function () {
        /* Se recarga para que no quede nada del contenido en pantalla */
        window.location.reload();
      });
    });
  }

  /* ======================================================================
     MENÚ LATERAL DEL PANEL
     ====================================================================== */

  function prepararMenu() {
    var menu = ui.q('.admin-menu');
    if (!menu) return;

    menu.addEventListener('click', function (e) {
      var boton = e.target.closest('button');
      if (!boton) return;

      var destino = boton.getAttribute('data-seccion');

      ui.qq('.admin-menu button').forEach(function (b) { b.classList.toggle('activo', b === boton); });
      ui.qq('.admin-seccion').forEach(function (s) {
        s.classList.toggle('activa', s.getAttribute('data-seccion') === destino);
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ======================================================================
     IDENTIDAD DEL SITIO
     Los textos que aparecen en el encabezado y el pie de las nueve páginas.
     ====================================================================== */

  function prepararSitio() {
    var form = ui.q('[data-admin="sitio"]');
    if (!form) return;

    LZ.store.leerSitio().then(function (sitio) {
      Object.keys(sitio).forEach(function (campo) {
        var input = form.querySelector('[name="' + campo + '"]');
        if (input) input.value = sitio[campo] === null ? '' : sitio[campo];
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var datos = {};
      ui.qq('input, textarea', form).forEach(function (i) {
        if (i.name) datos[i.name] = i.value.trim();
      });

      LZ.store.guardarSitio(datos).then(function () {
        ui.aviso('Identidad del sitio guardada.');
      }).catch(function (err) {
        ui.aviso(err.message || 'No se pudo guardar.', 'error');
      });
    });
  }

  /* ======================================================================
     LISTA + FORMULARIO DE CADA COLECCIÓN
     Una sola función arma las cinco secciones, guiándose por el esquema.
     ====================================================================== */

  function dibujarColeccion(coleccion) {
    var esquema = esquemas[coleccion];
    var seccion = ui.q('.admin-seccion[data-seccion="' + coleccion + '"]');
    if (!seccion) return;

    var lista = ui.q('[data-admin-lista]', seccion);
    var zonaForm = ui.q('[data-admin-form]', seccion);
    var botonNuevo = ui.q('[data-admin-nuevo]', seccion);

    botonNuevo.textContent = '+ Agregar ' + esquema.singular;
    botonNuevo.addEventListener('click', function () { abrirFormulario(null); });

    refrescar();

    function refrescar() {
      LZ.store.listar(coleccion).then(function (registros) {
        if (!registros.length) {
          ui.vacio(lista, 'Todavía no hay ' + esquema.titulo.toLowerCase() + ' cargados.');
          return;
        }

        lista.innerHTML = registros.map(function (r) {
          var res = esquema.resumen(r);

          var mini = esquema.foto
            ? '<div class="rf-mini">' +
                (res.img ? '<img src="' + ui.esc(res.img) + '" alt="">' : 'sin foto') +
              '</div>'
            : '';

          return '<div class="registro-fila">' + mini +
            '<div class="rf-datos"><strong>' + ui.esc(res.titulo) + '</strong>' +
              '<span>' + ui.esc(res.sub) + '</span></div>' +
            '<div class="rf-acciones">' +
              '<button type="button" class="btn btn--linea btn--sm" data-editar="' + r.id + '">Editar</button>' +
              '<button type="button" class="btn btn--peligro btn--sm" data-borrar="' + r.id + '">Borrar</button>' +
            '</div></div>';
        }).join('');

        ui.qq('[data-editar]', lista).forEach(function (b) {
          b.addEventListener('click', function () { abrirFormulario(b.getAttribute('data-editar')); });
        });

        ui.qq('[data-borrar]', lista).forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-borrar');
            if (!window.confirm('¿Borrar este registro? No se puede deshacer.')) return;

            LZ.store.eliminar(coleccion, id).then(function () {
              ui.aviso('Registro borrado.');
              zonaForm.innerHTML = '';
              refrescar();
            }).catch(function (err) {
              ui.aviso(err.message || 'No se pudo borrar.', 'error');
            });
          });
        });
      });
    }

    /* --- Formulario de alta / edición --- */
    function abrirFormulario(id) {
      var promesa = id ? LZ.store.obtener(coleccion, id) : Promise.resolve({});

      promesa.then(function (registro) {
        var r = registro || {};

        var campos = esquema.campos.map(function (c) {
          var valor = r[c.k] !== undefined && r[c.k] !== null ? r[c.k] : '';
          var estilo = c.ancho === 2 ? ' style="grid-column:1/-1"' : '';
          var control;

          if (c.t === 'textarea') {
            control = '<textarea name="' + c.k + '"' + (c.req ? ' required' : '') + '>' +
                      ui.esc(valor) + '</textarea>';
          } else {
            control = '<input type="' + c.t + '" name="' + c.k + '" value="' + ui.esc(valor) + '"' +
              (c.paso ? ' step="' + c.paso + '"' : '') + (c.req ? ' required' : '') + '>';
          }

          return '<div class="campo"' + estilo + '><label>' + ui.esc(c.l) + '</label>' + control +
            (c.ayuda ? '<p class="campo-ayuda">' + ui.esc(c.ayuda) + '</p>' : '') + '</div>';
        }).join('');

        /* Bloque de imagen, solo para las colecciones que tienen foto */
        var bloqueFoto = '';
        if (esquema.foto) {
          var actual = r[esquema.foto.k] || '';
          bloqueFoto =
            '<div class="campo" style="grid-column:1/-1">' +
              '<label>' + ui.esc(esquema.foto.l) + '</label>' +
              '<label class="zona-archivo" data-zona>' +
                '<input type="file" accept="image/*" data-archivo>' +
                '<strong>Elegí una imagen o arrastrala acá</strong>' +
                '<span>Se reduce a ' + LZ.config.foto.anchoMax + ' px de ancho antes de guardarla</span>' +
              '</label>' +
              '<input type="hidden" name="' + esquema.foto.k + '" value="' + ui.esc(actual) + '">' +
              '<div data-vista style="margin-top:12px">' +
                (actual ? '<img src="' + ui.esc(actual) + '" alt="" style="max-height:130px;border-radius:8px">' : '') +
              '</div>' +
            '</div>';
        }

        zonaForm.innerHTML =
          '<form class="panel mt-2" data-form>' +
            '<div class="panel-titulo"><h3>' +
              (id ? 'Editar ' + esquema.singular : 'Nuevo ' + esquema.singular) +
            '</h3></div>' +
            '<div class="campos-grid">' + campos + bloqueFoto + '</div>' +
            '<div class="fila" style="margin-top:20px">' +
              '<button type="submit" class="btn btn--oro">Guardar</button>' +
              '<button type="button" class="btn btn--fantasma" data-cancelar>Cancelar</button>' +
            '</div>' +
          '</form>';

        var form = ui.q('[data-form]', zonaForm);

        ui.q('[data-cancelar]', form).addEventListener('click', function () {
          zonaForm.innerHTML = '';
        });

        if (esquema.foto) prepararSubidaFoto(form);

        form.addEventListener('submit', function (e) {
          e.preventDefault();

          var datos = {};
          ui.qq('input, textarea', form).forEach(function (i) {
            if (!i.name) return;
            /* Los campos numéricos vacíos van como null, no como "" */
            datos[i.name] = i.type === 'number'
              ? (i.value === '' ? null : Number(i.value))
              : i.value.trim();
          });

          var accion = id
            ? LZ.store.actualizar(coleccion, id, datos)
            : LZ.store.crear(coleccion, datos);

          accion.then(function () {
            ui.aviso(id ? 'Cambios guardados.' : 'Registro creado.');
            zonaForm.innerHTML = '';
            refrescar();
          }).catch(function (err) {
            ui.aviso(err.message || 'No se pudo guardar.', 'error');
          });
        });
      });
    }
  }

  /* ======================================================================
     SUBIDA DE FOTOS
     Con la base de datos conectada, store.subirFoto manda la imagen al
     bucket de Supabase y devuelve su dirección pública. En modo local la
     guarda comprimida dentro del navegador. Esta pantalla no cambia.
     ====================================================================== */

  function prepararSubidaFoto(form) {
    var zona = ui.q('[data-zona]', form);
    var input = ui.q('[data-archivo]', form);
    var oculto = zona.parentNode.querySelector('input[type="hidden"]');
    var vista = ui.q('[data-vista]', form);

    function procesar(archivo) {
      if (!archivo) return;
      zona.querySelector('strong').textContent = 'Procesando…';

      LZ.store.subirFoto(archivo).then(function (url) {
        oculto.value = url;
        vista.innerHTML = '<img src="' + ui.esc(url) + '" alt="" style="max-height:130px;border-radius:8px">';
        zona.querySelector('strong').textContent = 'Imagen lista · elegí otra para reemplazarla';
      }).catch(function (err) {
        ui.aviso(err.message || 'No se pudo procesar la imagen.', 'error');
        zona.querySelector('strong').textContent = 'Elegí una imagen o arrastrala acá';
      });
    }

    input.addEventListener('change', function () { procesar(input.files[0]); });

    /* También se puede arrastrar la foto encima del recuadro */
    ['dragenter', 'dragover'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('encima'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('encima'); });
    });
    zona.addEventListener('drop', function (e) { procesar(e.dataTransfer.files[0]); });
  }

  /* ======================================================================
     SECCIÓN DATOS — de dónde salen, copia de seguridad y restauración
     ====================================================================== */

  function prepararDatos() {
    var caja = ui.q('[data-admin="estado"]');
    if (!caja) return;

    pintarEstado();
    prepararRestaurar();
    prepararExportar();

    function pintarEstado() {
      LZ.store.estado().then(function (e) {
        caja.className = 'backend-estado' +
          (e.conectado ? ' conectado' : (e.respaldo ? ' sin-conexion' : ''));
        caja.innerHTML = '<i></i><span>' + ui.esc(e.etiqueta) + '</span>';

        var detalle = ui.q('[data-admin="estado-detalle"]');
        if (detalle) {
          if (e.conectado) {
            detalle.textContent = 'El contenido y las fotos están en el servidor: los cambios se ven desde cualquier computadora.';
          } else if (e.respaldo) {
            detalle.textContent = 'No se pudo llegar a la base de datos (' + e.motivo +
              '). El sitio muestra la última copia guardada y no se puede editar hasta que vuelva la conexión.';
          } else {
            detalle.textContent = 'El contenido y las fotos viven en este navegador. Solo se ven en esta computadora.';
          }
        }

        /* Medidor de espacio: los navegadores dan alrededor de 5 MB */
        var medidor = ui.q('[data-admin="medidor"]');
        var texto = ui.q('[data-admin="medidor-texto"]');
        if (medidor && texto) {
          var porcentaje = Math.min(100, Math.round((e.espacioKb / 5120) * 100));
          medidor.querySelector('i').style.width = porcentaje + '%';
          texto.textContent = e.conectado
            ? 'Copia local de respaldo: ' + e.espacioKb + ' KB'
            : e.espacioKb + ' KB de ~5120 KB disponibles en el navegador (' + porcentaje + '%)';
        }
      });
    }

    function prepararRestaurar() {
      var boton = ui.q('[data-admin="restaurar"]');
      if (!boton) return;

      boton.addEventListener('click', function () {
        if (!window.confirm('Esto borra todos los cambios y vuelve al contenido original. ¿Continuar?')) return;

        LZ.store.restaurar().then(function () {
          ui.aviso('Contenido original restaurado.');
          setTimeout(function () { window.location.reload(); }, 800);
        }).catch(function (err) {
          ui.aviso(err.message, 'error');
        });
      });
    }

    /* Descarga todo el contenido en un archivo JSON. Sirve de respaldo y
       también para volver a generar data.js, que es lo que ve el sitio
       cuando no hay conexión. */
    function prepararExportar() {
      var boton = ui.q('[data-admin="exportar"]');
      if (!boton) return;

      boton.addEventListener('click', function () {
        var todo = {};
        var colecciones = ['metricas', 'equipo', 'componentes', 'galeria', 'bitacora', 'factores'];

        LZ.store.leerSitio().then(function (sitio) {
          todo.sitio = sitio;
          return Promise.all(colecciones.map(function (c) {
            return LZ.store.listar(c).then(function (l) { todo[c] = l; });
          }));
        }).then(function () {
          var blob = new Blob([JSON.stringify(todo, null, 2)], { type: 'application/json' });
          var enlace = document.createElement('a');
          enlace.href = URL.createObjectURL(blob);
          enlace.download = 'legacyz-contenido.json';
          enlace.click();
          URL.revokeObjectURL(enlace.href);
          ui.aviso('Copia de seguridad descargada.');
        }).catch(function (err) {
          ui.aviso(err.message || 'No se pudo generar la copia.', 'error');
        });
      });
    }
  }

})();
