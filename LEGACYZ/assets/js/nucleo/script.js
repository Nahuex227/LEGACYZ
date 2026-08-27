/* ==========================================================================
   LEGACYZ — script.js
   Arranque general del sitio. Se ejecuta en todas las páginas y hace cuatro
   cosas: prepara la interfaz común (tema, menú, animaciones), completa los
   textos de marca desde la capa de datos, arma el carrusel de la portada y
   dibuja las listas de contenido que cada página necesita.

   CÓMO SABE QUÉ DIBUJAR
   Cada página declara su nombre en <body data-pagina="..."> y marca los
   lugares donde va contenido con data-lista="algo". Este archivo busca esas
   marcas: si la página no las tiene, simplemente no hace nada. Por eso el
   mismo script.js sirve para las nueve páginas.

   Las páginas del sistema tienen además su propio archivo:
     calculadora.js · simulador.js · admin.js
   ========================================================================== */

(function () {
  'use strict';

  var ui = LZ.ui;

  document.addEventListener('DOMContentLoaded', function () {
    prepararTema();
    prepararMenu();
    prepararRevelado();
    completarMarca();
    iniciarCarrusel();
    dibujarContenidoDePagina();
  });

  /* ======================================================================
     TEMA CLARO / OSCURO
     La preferencia queda guardada en el navegador, así que se mantiene al
     pasar de una página a otra y al volver otro día.
     ====================================================================== */

  function prepararTema() {
    var guardado = null;
    try { guardado = localStorage.getItem(LZ.config.claveTema); } catch (e) {}
    if (guardado === 'claro') document.documentElement.setAttribute('data-tema', 'claro');

    ui.qq('[data-accion="tema"]').forEach(function (boton) {
      pintarBoton(boton);

      boton.addEventListener('click', function () {
        var claro = document.documentElement.getAttribute('data-tema') === 'claro';

        if (claro) {
          document.documentElement.removeAttribute('data-tema');
        } else {
          document.documentElement.setAttribute('data-tema', 'claro');
        }

        try { localStorage.setItem(LZ.config.claveTema, claro ? 'oscuro' : 'claro'); } catch (e) {}
        ui.qq('[data-accion="tema"]').forEach(pintarBoton);
      });
    });

    function pintarBoton(boton) {
      var claro = document.documentElement.getAttribute('data-tema') === 'claro';
      boton.textContent = claro ? '☾' : '☀';
      boton.setAttribute('title', claro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
      boton.setAttribute('aria-label', boton.getAttribute('title'));
    }
  }

  /* ======================================================================
     MENÚ EN CELULARES
     En pantallas chicas la navegación se esconde detrás del botón ☰.
     ====================================================================== */

  function prepararMenu() {
    var boton = ui.q('[data-accion="menu"]');
    var nav = ui.q('.nav');
    if (!boton || !nav) return;

    boton.addEventListener('click', function () {
      var abierto = nav.classList.toggle('abierta');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.textContent = abierto ? '✕' : '☰';
    });

    /* Al tocar un enlace, el menú se cierra solo */
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') nav.classList.remove('abierta');
    });
  }

  /* ======================================================================
     APARICIÓN SUAVE AL HACER SCROLL
     Los elementos con class="revelar" aparecen cuando entran en pantalla.
     Si el navegador no soporta IntersectionObserver, se muestran todos de
     una: el contenido nunca queda invisible.
     ====================================================================== */

  function prepararRevelado() {
    var elementos = ui.qq('.revelar:not(.visible)');

    if (!elementos.length) return;

    if (!('IntersectionObserver' in window)) {
      elementos.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visible');
          observador.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    elementos.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      observador.observe(el);
    });
  }

  /* ======================================================================
     TEXTOS DE MARCA
     Reemplaza el contenido de los [data-sitio="campo"] con lo que esté
     guardado. Gracias a esto, cambiar el nombre o el slogan en el panel de
     administración actualiza las nueve páginas a la vez.
     ====================================================================== */

  function completarMarca() {
    LZ.store.leerSitio().then(function (sitio) {
      ui.qq('[data-sitio]').forEach(function (el) {
        var campo = el.getAttribute('data-sitio');
        if (!sitio[campo]) return;
        el.textContent = sitio[campo];

        /* El mail del pie no es solo texto: es un enlace. Si se cambia la
           direccion en el panel hay que actualizar tambien el destino, o el
           texto diria una cosa y el enlace llevaria a otra. */
        if (campo === 'email' && el.tagName === 'A') el.href = 'mailto:' + sitio[campo];
      });

      dibujarDonacion(sitio);
    });
  }

  /* ======================================================================
     BOTON DE DONACION
     Aparece en el pie de las nueve paginas, pero SOLO si en el panel de
     administracion hay cargado un link de pago o un alias. Mientras los dos
     campos esten vacios el bloque queda oculto: el sitio nunca muestra un
     boton de donar que no lleva a ningun lado.

     Los datos salen de la tabla "sitio":
       donacion_url    link de pago (Mercado Pago u otro)
       donacion_alias  alias o CVU para transferir
       donacion_texto  texto del boton, opcional
     ====================================================================== */

  function dibujarDonacion(sitio) {
    var bloques = ui.qq('[data-donacion]');
    if (!bloques.length) return;

    var url   = String(sitio.donacion_url   || '').trim();
    var alias = String(sitio.donacion_alias || '').trim();
    var texto = String(sitio.donacion_texto || '').trim() || 'Colaborar con el proyecto';

    /* Solo se aceptan direcciones http(s). Sin este control, un link mal
       cargado en el panel podria ejecutar codigo al hacer clic. */
    if (url && !/^https?:\/\//i.test(url)) url = '';
    if (!url && !alias) return;

    bloques.forEach(function (bloque) {
      var botones = '';

      if (url) {
        botones += '<a class="btn btn--oro" href="' + ui.esc(url) + '"' +
                   ' target="_blank" rel="noopener noreferrer">' + ui.esc(texto) + '</a>';
      }
      if (alias) {
        botones += '<button type="button" class="btn btn--linea" data-copiar="' +
                   ui.esc(alias) + '">Copiar alias: ' + ui.esc(alias) + '</button>';
      }

      bloque.innerHTML =
        '<h4>Colaborar</h4>' +
        '<p>LEGACYZ se sostiene con lo que aporta cada uno. Con lo que juntamos ' +
        'compramos componentes y seguimos mejorando el dispositivo.</p>' +
        '<div class="fila fila--donacion">' + botones + '</div>';
      bloque.hidden = false;
    });

    dibujarBotonFlotante(url, alias, texto);
    prepararCopiado();
  }

  /* ======================================================================
     BOTON FLOTANTE "DONAR"
     El bloque del pie explica para que es la plata; este boton hace que la
     opcion este siempre a mano, sin tener que bajar hasta el final.

     Se arma segun cuantas formas de colaborar haya cargadas:
       una sola   el boton hace directamente esa accion
       las dos    el boton abre un panelito con las dos opciones
     ====================================================================== */

  function dibujarBotonFlotante(url, alias, texto) {
    if (document.querySelector('.donar-flotante')) return;

    var caja = document.createElement('div');
    caja.className = 'donar-flotante';

    /* Con una sola opcion no hace falta panel: el boton ES la accion. */
    if (url && !alias) {
      caja.innerHTML = '<a class="btn btn--oro" href="' + ui.esc(url) + '"' +
                       ' target="_blank" rel="noopener noreferrer">Donar</a>';
      document.body.appendChild(caja);
      return;
    }
    if (alias && !url) {
      caja.innerHTML = '<button type="button" class="btn btn--oro" data-copiar="' +
                       ui.esc(alias) + '">Donar</button>';
      document.body.appendChild(caja);
      prepararCopiado(caja);
      return;
    }

    /* Con las dos, el boton abre y cierra el panel. */
    caja.innerHTML =
      '<div class="donar-opciones" id="donar-opciones" hidden>' +
        '<p>Elegí cómo colaborar</p>' +
        '<a class="btn btn--oro" href="' + ui.esc(url) + '" target="_blank"' +
        ' rel="noopener noreferrer">' + ui.esc(texto) + '</a>' +
        '<button type="button" class="btn btn--linea" data-copiar="' +
        ui.esc(alias) + '">Copiar alias</button>' +
      '</div>' +
      '<button type="button" class="btn btn--oro" data-donar-abrir' +
      ' aria-expanded="false" aria-controls="donar-opciones">Donar</button>';
    document.body.appendChild(caja);

    var boton  = ui.q('[data-donar-abrir]', caja);
    var panel  = ui.q('.donar-opciones', caja);

    function mostrar(abierto) {
      panel.hidden = !abierto;
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.textContent = abierto ? 'Cerrar' : 'Donar';
    }

    boton.addEventListener('click', function () { mostrar(panel.hidden); });

    /* Se cierra con Escape o tocando fuera: si no, queda tapando la pagina. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { mostrar(false); boton.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !caja.contains(e.target)) mostrar(false);
    });

    prepararCopiado(caja);
  }

  /* ======================================================================
     COPIAR EL ALIAS
     Un solo escuchador para todos los botones que lo pidan, y el cartelito
     de siempre para confirmar. Si el navegador no deja copiar (pasa cuando
     la pagina no esta en https), al menos se muestra el alias para anotarlo.
     ====================================================================== */

  function prepararCopiado(dentro) {
    ui.qq('[data-copiar]', dentro).forEach(function (boton) {
      if (boton.dataset.copiarListo) return;
      boton.dataset.copiarListo = '1';

      boton.addEventListener('click', function () {
        var valor = boton.getAttribute('data-copiar');
        if (!navigator.clipboard) { ui.aviso('Alias para transferir: ' + valor); return; }
        navigator.clipboard.writeText(valor).then(function () {
          ui.aviso('Alias copiado: ' + valor);
        }).catch(function () {
          ui.aviso('Alias para transferir: ' + valor);
        });
      });
    });
  }

  /* ======================================================================
     CARRUSEL DE LA PORTADA
     ====================================================================== */

  function iniciarCarrusel() {
    var carrusel = ui.q('.carrusel');
    if (!carrusel) return;

    var pista = ui.q('[data-lista="carrusel"]', carrusel);
    if (!pista) { activar(carrusel); return; }

    /* Las fotos del carrusel salen de la galería. Se priorizan las que ya
       tienen imagen cargada; si faltan, se completa con una de cada
       categoría para que las tres no se vean iguales. */
    LZ.store.listar('galeria').then(function (lista) {
      var conFoto = lista.filter(function (f) { return f.url; });
      var sinFoto = lista.filter(function (f) { return !f.url; });

      /* Una por categoría primero, después el resto */
      var vistas = [];
      var variadas = sinFoto.filter(function (f) {
        if (vistas.indexOf(f.categoria) !== -1) return false;
        vistas.push(f.categoria);
        return true;
      });
      var sobrantes = sinFoto.filter(function (f) { return variadas.indexOf(f) === -1; });

      var elegidas = conFoto.concat(variadas, sobrantes).slice(0, 3);

      pista.innerHTML = elegidas.map(function (f, i) {
        return '<div class="carrusel-slide' + (i === 0 ? ' activo' : '') + '">' +
          ui.foto(f.url, f.titulo, f.categoria) +
          '<div class="carrusel-pie">' + ui.esc(f.titulo) + '</div>' +
          '</div>';
      }).join('');

      var cajaPuntos = ui.q('[data-lista="carrusel-puntos"]', carrusel);
      if (cajaPuntos) {
        cajaPuntos.innerHTML = elegidas.map(function (f, i) {
          return '<button type="button" class="punto' + (i === 0 ? ' activo' : '') +
            '" aria-label="Foto ' + (i + 1) + '"></button>';
        }).join('');
      }

      activar(carrusel);
    });
  }

  function activar(carrusel) {
    var slides = ui.qq('.carrusel-slide', carrusel);
    var puntos = ui.qq('.punto', carrusel);
    if (slides.length < 2) return;

    var actual = 0;
    var reloj = null;

    function mostrar(indice) {
      actual = (indice + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('activo', i === actual); });
      puntos.forEach(function (p, i) {
        p.classList.toggle('activo', i === actual);
        p.setAttribute('aria-current', i === actual ? 'true' : 'false');
      });
    }

    function reiniciarReloj() {
      clearInterval(reloj);
      reloj = setInterval(function () { mostrar(actual + 1); }, 5000);
    }

    ui.qq('[data-carrusel]', carrusel).forEach(function (boton) {
      boton.addEventListener('click', function () {
        mostrar(actual + parseInt(boton.getAttribute('data-carrusel'), 10));
        reiniciarReloj();
      });
    });

    puntos.forEach(function (punto, i) {
      punto.addEventListener('click', function () { mostrar(i); reiniciarReloj(); });
    });

    /* Si el mouse está encima, el carrusel no avanza solo: da tiempo a leer */
    carrusel.addEventListener('mouseenter', function () { clearInterval(reloj); });
    carrusel.addEventListener('mouseleave', reiniciarReloj);

    mostrar(0);
    reiniciarReloj();
  }

  /* ======================================================================
     CONTENIDO DE CADA PÁGINA
     Se dibuja solo lo que la página pide. Si no existe el contenedor, la
     función ni se llama.
     ====================================================================== */

  function dibujarContenidoDePagina() {
    if (ui.q('[data-lista="metricas"]'))    dibujarMetricas();
    if (ui.q('[data-lista="componentes"]')) dibujarComponentes();
    if (ui.q('[data-lista="factores"]'))    dibujarFactores();
    if (ui.q('[data-lista="equipo"]'))      dibujarEquipo();
    if (ui.q('[data-lista="galeria"]'))     dibujarGaleria();
    if (ui.q('[data-lista="bitacora"]'))    dibujarBitacora();
    resaltarCodigo();
  }

  /* ======================================================================
     RESALTADO DE CÓDIGO
     Pinta comentarios, textos, números y palabras clave de los bloques
     <code data-lenguaje>. Está hecho a mano con una expresión regular:
     no usa ninguna librería externa, así que funciona sin internet.
     ====================================================================== */

  function resaltarCodigo() {
    var CLAVES = 'void|int|float|char|byte|const|bool|if|else|switch|case|break|return|enum|String|true|false|for|while|include|define';

    var patron = new RegExp(
      '(\\/\\/[^\\n]*)' +          // comentarios
      '|("(?:[^"\\\\]|\\\\.)*")' + // textos entre comillas dobles
      "|('(?:[^'\\\\]|\\\\.)*')" + // caracteres entre comillas simples
      '|(#\\w+)' +                 // directivas del preprocesador
      '|(\\b\\d+\\.?\\d*\\b)' +    // números
      '|(\\b(?:' + CLAVES + ')\\b)', 'g');

    ui.qq('code[data-lenguaje]').forEach(function (bloque) {
      if (bloque.dataset.listo) return;   // no repetir si ya se pintó
      bloque.dataset.listo = '1';

      var texto = bloque.textContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      bloque.innerHTML = texto.replace(patron, function (m, com, str, chr, dir, num, key) {
        if (com) return '<span class="c-com">' + com + '</span>';
        if (str || chr) return '<span class="c-str">' + (str || chr) + '</span>';
        if (dir) return '<span class="c-key">' + dir + '</span>';
        if (num) return '<span class="c-num">' + num + '</span>';
        if (key) return '<span class="c-key">' + key + '</span>';
        return m;
      });
    });
  }

  /* --- Datos rápidos de la portada ------------------------------------ */

  function dibujarMetricas() {
    var caja = ui.q('[data-lista="metricas"]');

    LZ.store.metricas().then(function (lista) {
      caja.innerHTML = lista.map(function (m) {
        return '<div class="dato">' +
          '<span class="dato-numero">' + ui.esc(m.valor) + '</span>' +
          '<span class="dato-label">' + ui.esc(m.etiqueta) + '</span>' +
          '</div>';
      }).join('');
    });
  }

  /* --- Tabla de componentes, con buscador ----------------------------- */

  function dibujarComponentes() {
    var cuerpo = ui.q('[data-lista="componentes"]');
    var buscador = ui.q('[data-buscar="componentes"]');
    var contador = ui.q('[data-contador="componentes"]');
    var todos = [];

    LZ.store.listar('componentes').then(function (lista) {
      todos = lista;
      pintar('');
    });

    function pintar(texto) {
      var filtro = texto.trim().toLowerCase();

      var visibles = todos.filter(function (c) {
        if (!filtro) return true;
        return (c.nombre + ' ' + c.funcion + ' ' + c.categoria + ' ' + c.pines)
          .toLowerCase().indexOf(filtro) !== -1;
      });

      if (contador) {
        contador.textContent = visibles.length === todos.length
          ? todos.length + ' componentes'
          : visibles.length + ' de ' + todos.length;
      }

      if (!visibles.length) {
        cuerpo.innerHTML = '<tr><td colspan="4" class="tabla-vacia">Ningún componente coincide con «' +
                           ui.esc(texto) + '»</td></tr>';
        return;
      }

      cuerpo.innerHTML = visibles.map(function (c) {
        return '<tr>' +
          '<td>' + ui.esc(c.nombre) +
            '<br><span class="pastilla" style="margin-top:6px">' + ui.esc(c.categoria) + '</span></td>' +
          '<td>' + ui.esc(c.funcion) + '</td>' +
          '<td class="mono">' + ui.esc(c.pines) + '</td>' +
          '<td class="mono">' + ui.esc(c.cantidad) + '</td>' +
          '</tr>';
      }).join('');
    }

    if (buscador) {
      buscador.addEventListener('input', function () { pintar(buscador.value); });
    }
  }

  /* --- Tabla de factores de proteína ---------------------------------- */

  function dibujarFactores() {
    var cuerpo = ui.q('[data-lista="factores"]');

    LZ.store.listar('factores').then(function (lista) {
      cuerpo.innerHTML = lista.map(function (f) {
        return '<tr>' +
          '<td>' + ui.esc(f.nombre) + '</td>' +
          '<td>' + ui.esc(f.descripcion) + '</td>' +
          '<td class="mono">' + ui.num(f.min) + ' – ' + ui.num(f.max) + ' g/kg</td>' +
          '<td class="mono">' + ui.num(f.medio, 2) + ' g/kg</td>' +
          '<td>' + (f.en_dispositivo
            ? '<span class="pastilla">Tecla ' + ui.esc(f.tecla) + '</span>'
            : '<span style="color:var(--lz-texto-suave);font-size:.82rem">Solo web</span>') + '</td>' +
          '</tr>';
      }).join('');
    });
  }

  /* --- Equipo --------------------------------------------------------- */

  function dibujarEquipo() {
    var caja = ui.q('[data-lista="equipo"]');

    LZ.store.listar('equipo').then(function (lista) {
      if (!lista.length) { ui.vacio(caja, 'Todavía no hay integrantes cargados.'); return; }

      caja.innerHTML = lista.map(function (p) {
        /* Sin foto cargada se muestran las iniciales: se ve prolijo y
           deliberado, no como una imagen que falló. */
        var foto = p.foto
          ? '<img src="' + ui.esc(p.foto) + '" alt="Foto de ' + ui.esc(p.nombre) + '">'
          : ui.iniciales(p.nombre);

        return '<article class="integrante revelar">' +
          '<div class="integrante-foto">' + foto + '</div>' +
          '<h3>' + ui.esc(p.nombre) + '</h3>' +
          '<span class="integrante-rol">' + ui.esc(p.rol) + '</span>' +
          '<p>' + ui.esc(p.aporte) + '</p>' +
          '</article>';
      }).join('');

      prepararRevelado();
    });
  }

  /* --- Galería con filtros y visor ampliado --------------------------- */

  function dibujarGaleria() {
    var caja = ui.q('[data-lista="galeria"]');
    var chips = ui.q('[data-filtros="galeria"]');
    var contador = ui.q('[data-contador="galeria"]');

    var todas = [];
    var visibles = [];
    var categoria = 'Todas';

    LZ.store.listar('galeria').then(function (lista) {
      todas = lista;

      /* Los filtros se arman solos con las categorías que existan: si en
         el panel se agrega una categoría nueva, aparece acá sin tocar el
         código de esta página. */
      if (chips) {
        var cats = ['Todas'];
        todas.forEach(function (f) { if (cats.indexOf(f.categoria) === -1) cats.push(f.categoria); });

        chips.innerHTML = cats.map(function (c) {
          return '<button type="button" class="chip' + (c === 'Todas' ? ' activo' : '') +
                 '" data-cat="' + ui.esc(c) + '">' + ui.esc(c) + '</button>';
        }).join('');

        chips.addEventListener('click', function (e) {
          var boton = e.target.closest('.chip');
          if (!boton) return;
          categoria = boton.getAttribute('data-cat');
          ui.qq('.chip', chips).forEach(function (c) { c.classList.toggle('activo', c === boton); });
          pintar();
        });
      }

      pintar();
    });

    function pintar() {
      visibles = todas.filter(function (f) {
        return categoria === 'Todas' || f.categoria === categoria;
      });

      if (contador) {
        contador.textContent = visibles.length + (visibles.length === 1 ? ' foto' : ' fotos');
      }

      if (!visibles.length) { ui.vacio(caja, 'No hay fotos en esta categoría.'); return; }

      caja.innerHTML = visibles.map(function (f, i) {
        return '<button type="button" class="galeria-item revelar" data-indice="' + i + '">' +
          '<div class="galeria-marco">' +
            '<span class="galeria-cat">' + ui.esc(f.categoria) + '</span>' +
            ui.foto(f.url, f.titulo, f.categoria) +
          '</div>' +
          '<div class="galeria-texto">' +
            '<h3 style="font-size:.95rem;margin-bottom:4px">' + ui.esc(f.titulo) + '</h3>' +
            '<p>' + ui.esc(f.descripcion) + '</p>' +
          '</div>' +
          '</button>';
      }).join('');

      prepararRevelado();

      ui.qq('.galeria-item', caja).forEach(function (item) {
        item.addEventListener('click', function () {
          abrirLightbox(parseInt(item.getAttribute('data-indice'), 10));
        });
      });
    }

    /* --- Visor ampliado (lightbox) --- */
    var lightbox = ui.q('.lightbox');
    var indiceActual = 0;

    function abrirLightbox(indice) {
      if (!lightbox || !visibles.length) return;

      indiceActual = (indice + visibles.length) % visibles.length;
      var f = visibles[indiceActual];

      ui.q('[data-lb="imagen"]', lightbox).innerHTML = ui.foto(f.url, f.titulo, f.categoria);
      ui.q('[data-lb="titulo"]', lightbox).textContent = f.titulo;
      ui.q('[data-lb="desc"]', lightbox).textContent = f.descripcion;
      ui.q('[data-lb="pos"]', lightbox).textContent = (indiceActual + 1) + ' / ' + visibles.length;

      lightbox.classList.add('abierto');
      document.body.style.overflow = 'hidden';   // no se hace scroll detrás
    }

    function cerrarLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('abierto');
      document.body.style.overflow = '';
    }

    if (lightbox) {
      ui.q('[data-lb="cerrar"]', lightbox).addEventListener('click', cerrarLightbox);
      ui.q('[data-lb="prev"]', lightbox).addEventListener('click', function () { abrirLightbox(indiceActual - 1); });
      ui.q('[data-lb="next"]', lightbox).addEventListener('click', function () { abrirLightbox(indiceActual + 1); });
      lightbox.addEventListener('click', function (e) { if (e.target === lightbox) cerrarLightbox(); });

      /* También se maneja con el teclado: Escape cierra, flechas navegan */
      document.addEventListener('keydown', function (e) {
        if (!lightbox.classList.contains('abierto')) return;
        if (e.key === 'Escape') cerrarLightbox();
        if (e.key === 'ArrowRight') abrirLightbox(indiceActual + 1);
        if (e.key === 'ArrowLeft') abrirLightbox(indiceActual - 1);
      });
    }
  }

  /* --- Bitácora ------------------------------------------------------- */

  function dibujarBitacora() {
    var caja = ui.q('[data-lista="bitacora"]');

    LZ.store.listar('bitacora').then(function (lista) {
      if (!lista.length) { ui.vacio(caja, 'Todavía no hay entradas en la bitácora.'); return; }

      caja.innerHTML = lista.map(function (h) {
        return '<article class="hito revelar">' +
          '<span class="hito-fecha">' + ui.esc(ui.fecha(h.fecha)) + '</span>' +
          '<h3>' + ui.esc(h.titulo) + '</h3>' +
          '<p>' + ui.esc(h.texto) + '</p>' +
          '</article>';
      }).join('');

      prepararRevelado();
    });
  }

})();
