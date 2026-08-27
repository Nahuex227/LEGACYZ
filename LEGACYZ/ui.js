/* ==========================================================================
   LEGACYZ — ui.js
   Funciones cortas que se repiten en todas las páginas: buscar elementos,
   escapar texto, mostrar avisos, formatear fechas y números, y generar los
   marcadores de imagen mientras no haya fotos reales cargadas.

   No maneja datos: para eso está store.js. Acá solo hay ayudas de interfaz.
   ========================================================================== */

window.LZ = window.LZ || {};

LZ.ui = {

  /* Atajo de document.querySelector: devuelve el PRIMER elemento que
     coincide con el selector, o null si no hay ninguno. */
  q: function (selector, dentro) {
    return (dentro || document).querySelector(selector);
  },

  /* Igual que q pero devuelve TODOS, ya convertidos en un array de verdad
     para poder usar forEach, map y filter. */
  qq: function (selector, dentro) {
    return Array.prototype.slice.call((dentro || document).querySelectorAll(selector));
  },

  /* Convierte texto en HTML seguro.
     IMPORTANTE: se usa siempre que un texto cargado desde el panel se
     inserta con innerHTML. Sin esto, un texto que contenga < o > podría
     romper la página o inyectar etiquetas que nadie escribió. */
  esc: function (texto) {
    return String(texto === undefined || texto === null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /* Iniciales de un nombre. Se usan como foto del integrante mientras no
     haya una imagen cargada: se ve intencional, no como una foto rota. */
  iniciales: function (nombre) {
    return String(nombre || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); })
      .join('');
  },

  /* ======================================================================
     MARCADORES DE IMAGEN

     Mientras la galería no tenga fotos reales, en lugar de una imagen rota
     dibujamos una ilustración distinta según la categoría. Se genera acá
     mismo como SVG y se entrega como "data URI": no es un archivo aparte,
     no se descarga nada de internet y funciona sin conexión.

     Cuando se sube la foto real desde admin.html, el marcador desaparece
     solo: ui.foto() usa la imagen si existe y el marcador si no.
     ====================================================================== */

  /* Paleta fija. No puede usar las variables CSS del sitio porque el SVG
     va dentro de un <img>, y ahí adentro las variables no llegan. */
  _paleta: {
    fondo: '#121214',
    linea: '#D4AF37',
    texto: '#6E6C76'
  },

  marcador: function (categoria, titulo) {
    var p = this._paleta;
    var dibujo = '';
    var cat = String(categoria || '');

    if (cat === 'Construcción') {
      /* Protoboard: la grilla de agujeritos donde se arma el circuito */
      var puntos = '';
      for (var f = 0; f < 7; f++) {
        for (var c = 0; c < 15; c++) {
          puntos += '<circle cx="' + (130 + c * 40) + '" cy="' + (190 + f * 40) + '" r="4"/>';
        }
      }
      dibujo = '<g fill="' + p.linea + '" opacity="0.20">' + puntos + '</g>' +
               '<rect x="108" y="168" width="584" height="284" rx="10" fill="none" ' +
               'stroke="' + p.linea + '" stroke-width="2" opacity="0.30"/>';

    } else if (cat === 'Circuito') {
      /* Pistas y nodos, como un esquema de conexiones */
      dibujo =
        '<g fill="none" stroke="' + p.linea + '" stroke-width="3" opacity="0.28" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M110 210 H300 V330 H520 V190 H690"/>' +
          '<path d="M110 410 H240 V270"/>' +
          '<path d="M380 410 H690"/>' +
          '<path d="M380 330 V410"/>' +
        '</g>' +
        '<g fill="' + p.linea + '" opacity="0.45">' +
          '<circle cx="300" cy="330" r="8"/><circle cx="520" cy="190" r="8"/>' +
          '<circle cx="240" cy="270" r="8"/><circle cx="380" cy="410" r="8"/>' +
        '</g>';

    } else if (cat === 'Funcionando') {
      /* La pantalla LCD de 16x2 encendida */
      var celdas = '';
      for (var fila = 0; fila < 2; fila++) {
        for (var col = 0; col < 16; col++) {
          celdas += '<rect x="' + (226 + col * 22) + '" y="' + (256 + fila * 46) +
                    '" width="14" height="30" rx="2"/>';
        }
      }
      dibujo =
        '<rect x="196" y="216" width="408" height="168" rx="12" fill="#0B3C8C" opacity="0.55"/>' +
        '<rect x="196" y="216" width="408" height="168" rx="12" fill="none" ' +
        'stroke="' + p.linea + '" stroke-width="2" opacity="0.35"/>' +
        '<g fill="#EAF2FF" opacity="0.30">' + celdas + '</g>';

    } else {
      /* Cualquier otra categoría: un marco sobrio con una diagonal */
      dibujo =
        '<rect x="150" y="170" width="500" height="280" rx="12" fill="none" ' +
        'stroke="' + p.linea + '" stroke-width="2" opacity="0.28"/>' +
        '<path d="M150 450 L400 250 L650 450" fill="none" stroke="' + p.linea +
        '" stroke-width="3" opacity="0.28" stroke-linejoin="round"/>' +
        '<circle cx="290" cy="248" r="26" fill="' + p.linea + '" opacity="0.30"/>';
    }

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">' +
        '<rect width="800" height="600" fill="' + p.fondo + '"/>' +
        dibujo +
        /* Monograma de la marca, arriba a la derecha.
           Va en esa esquina y no en otra porque las demás están ocupadas:
           arriba a la izquierda va el cartelito de categoría de la galería,
           abajo va el pie del carrusel, y a los costados los botones de
           avanzar y retroceder. La categoría no se escribe acá: ya la
           muestra el cartelito, y repetirla se veía duplicado. */
        '<rect x="708" y="40" width="52" height="52" rx="12" fill="none" ' +
          'stroke="' + p.linea + '" stroke-width="2" opacity="0.5"/>' +
        '<text x="734" y="74" text-anchor="middle" font-family="sans-serif" ' +
          'font-size="20" font-weight="700" fill="' + p.linea + '" opacity="0.75">LZ</text>' +
      '</svg>';

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  },

  /* Devuelve la etiqueta <img> de una foto.
     Si todavía no hay imagen cargada, usa el marcador de la categoría.
     Así el sitio siempre se ve completo y nunca aparece un ícono roto. */
  foto: function (url, alt, categoria) {
    var origen = url || this.marcador(categoria, alt);
    var esReal = !!url;

    return '<img src="' + this.esc(origen) + '" alt="' + this.esc(alt) + '"' +
           (esReal ? ' loading="lazy"' : ' data-marcador="1"') + '>';
  },

  /* ======================================================================
     FECHAS Y NÚMEROS
     ====================================================================== */

  /* 2026-05-13 → 13 de mayo de 2026 */
  fecha: function (iso) {
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    return parseInt(p[2], 10) + ' de ' + meses[parseInt(p[1], 10) - 1] + ' de ' + p[0];
  },

  /* Fecha y hora corta para el historial de cálculos: 13/05 14:30 */
  fechaHora: function (marca) {
    var d = new Date(marca);
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + ' ' +
           dos(d.getHours()) + ':' + dos(d.getMinutes());
  },

  /* Número con coma decimal, como se escribe en Argentina: 1,35 */
  num: function (valor, decimales) {
    var d = decimales === undefined ? 1 : decimales;
    return Number(valor).toFixed(d).replace('.', ',');
  },

  /* ======================================================================
     AVISOS Y ESTADOS VACÍOS
     ====================================================================== */

  /* Cartel flotante abajo a la derecha. tipo 'error' lo pinta en rojo. */
  aviso: function (mensaje, tipo) {
    var caja = this.q('.avisos');
    if (!caja) {
      caja = document.createElement('div');
      caja.className = 'avisos';
      document.body.appendChild(caja);
    }

    var el = document.createElement('div');
    el.className = 'aviso' + (tipo === 'error' ? ' error' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<i>' + (tipo === 'error' ? '!' : '✓') + '</i><span>' + this.esc(mensaje) + '</span>';
    caja.appendChild(el);

    /* Los errores quedan más tiempo en pantalla que las confirmaciones */
    var duracion = tipo === 'error' ? 5200 : 3200;
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 300);
    }, duracion);
  },

  /* Mensaje para cuando una lista no tiene nada que mostrar */
  vacio: function (contenedor, mensaje) {
    contenedor.innerHTML = '<div class="tabla-vacia">' + this.esc(mensaje) + '</div>';
  }
};
