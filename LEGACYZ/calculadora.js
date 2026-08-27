/* ==========================================================================
   LEGACYZ — calculadora.js
   Versión web de la calculadora.

   Usa exactamente los mismos factores que el dispositivo y la misma
   fórmula de la guía práctica:

        peso (kg)  ×  factor (g/kg)  =  gramos de proteína por día

   La diferencia con el aparato es que acá entran las CINCO categorías
   (en la pantalla de 16 columnas solo entraban tres) y además se muestra
   el rango mínimo–máximo, no solo el valor medio.
   ========================================================================== */

(function () {
  'use strict';

  var ui = LZ.ui;

  var factores = [];    // las categorías, traídas de la capa de datos
  var elegido = null;   // la categoría que marcó el visitante

  document.addEventListener('DOMContentLoaded', function () {
    if (!ui.q('[data-calc="form"]')) return;
    cargarObjetivos();
    prepararFormulario();
    dibujarHistorial();   // al terminar de leer, actualiza la nota de abajo
  });

  /* ======================================================================
     OPCIONES DE OBJETIVO
     No están escritas en el HTML: se leen de la tabla de factores. Si en
     admin.html se agrega una categoría nueva, aparece acá automáticamente.
     ====================================================================== */

  function cargarObjetivos() {
    var caja = ui.q('[data-calc="objetivos"]');

    LZ.store.listar('factores').then(function (lista) {
      factores = lista;

      caja.innerHTML = lista.map(function (f) {
        return '<label class="objetivo" data-id="' + f.id + '">' +
          '<input type="radio" name="objetivo" value="' + f.id + '">' +
          '<span class="objetivo-info">' +
            '<strong>' + ui.esc(f.nombre) + '</strong>' +
            '<span>' + ui.esc(f.descripcion) + '</span>' +
          '</span>' +
          '<span class="objetivo-factor">' + ui.num(f.min) + '–' + ui.num(f.max) + ' g/kg</span>' +
          '</label>';
      }).join('');

      caja.addEventListener('change', function (e) {
        if (e.target.name !== 'objetivo') return;

        elegido = buscarFactor(e.target.value);

        ui.qq('.objetivo', caja).forEach(function (el) {
          el.classList.toggle('elegido', el.getAttribute('data-id') === String(elegido.id));
        });

        ui.q('[data-calc="error-objetivo"]').classList.remove('visible');
      });
    });
  }

  function buscarFactor(id) {
    var encontrado = null;
    factores.forEach(function (f) { if (String(f.id) === String(id)) encontrado = f; });
    return encontrado;
  }

  /* ======================================================================
     FORMULARIO Y VALIDACIÓN
     Se valida antes de calcular: sin peso o sin objetivo no hay resultado,
     igual que en el dispositivo, donde la tecla A no hace nada si todavía
     no se escribió un peso.
     ====================================================================== */

  function prepararFormulario() {
    var form = ui.q('[data-calc="form"]');
    var peso = ui.q('[data-calc="peso"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var errorPeso = ui.q('[data-calc="error-peso"]');
      var errorObj = ui.q('[data-calc="error-objetivo"]');
      var valido = true;

      /* Se acepta 70,5 igual que 70.5: en Argentina se escribe con coma */
      var kg = parseFloat(String(peso.value).replace(',', '.'));

      if (!peso.value) {
        mostrarError(peso, errorPeso, 'Ingresá el peso en kilogramos.');
        valido = false;
      } else if (isNaN(kg) || kg < 25 || kg > 250) {
        mostrarError(peso, errorPeso, 'El peso debe estar entre 25 y 250 kg.');
        valido = false;
      } else {
        limpiarError(peso, errorPeso);
      }

      if (!elegido) {
        errorObj.textContent = 'Elegí un objetivo de la lista.';
        errorObj.classList.add('visible');
        valido = false;
      }

      if (!valido) return;

      var resultado = calcular(kg, elegido);
      mostrarResultado(resultado);
      guardar(resultado);
    });

    form.addEventListener('reset', function () {
      /* El reset del navegador ocurre después de este evento: por eso se
         espera un instante antes de limpiar lo que dibujamos nosotros. */
      setTimeout(function () {
        elegido = null;
        ui.qq('.objetivo').forEach(function (el) { el.classList.remove('elegido'); });
        ui.q('[data-calc="resultado"]').innerHTML = plantillaVacia();
        limpiarError(peso, ui.q('[data-calc="error-peso"]'));
        ui.q('[data-calc="error-objetivo"]').classList.remove('visible');
      }, 0);
    });

    peso.addEventListener('input', function () {
      limpiarError(peso, ui.q('[data-calc="error-peso"]'));
    });
  }

  function mostrarError(campo, caja, mensaje) {
    campo.classList.add('invalido');
    caja.textContent = mensaje;
    caja.classList.add('visible');
  }

  function limpiarError(campo, caja) {
    campo.classList.remove('invalido');
    caja.classList.remove('visible');
  }

  /* ======================================================================
     EL CÁLCULO — la misma cuenta que hace el Arduino
     ====================================================================== */

  function calcular(kg, factor) {
    return {
      peso:       kg,
      objetivo:   factor.nombre,
      factor_id:  factor.id,
      factor:     factor.medio,
      gramos:     kg * factor.medio,   /* el valor recomendado */
      gramos_min: kg * factor.min,     /* el piso del rango */
      gramos_max: kg * factor.max,     /* el techo del rango */
      fecha:      new Date().toISOString()
    };
  }

  /* ======================================================================
     RESULTADO EN PANTALLA
     ====================================================================== */

  function mostrarResultado(r) {
    ui.q('[data-calc="resultado"]').innerHTML =
      '<div class="resultado">' +
        '<div class="resultado-cifra">' + ui.num(r.gramos, 0) + '</div>' +
        '<div class="resultado-unidad">gramos de proteína por día</div>' +
        '<div class="resultado-formula">' +
          ui.num(r.peso, 0) + ' kg &nbsp;×&nbsp; <b>' + ui.num(r.factor, 2) + ' g/kg</b> &nbsp;=&nbsp; <b>' +
          ui.num(r.gramos, 1) + ' g</b>' +
        '</div>' +
        '<div class="resultado-rango">' +
          '<div><span>Mínimo</span><strong>' + ui.num(r.gramos_min, 0) + ' g</strong></div>' +
          '<div class="destacado"><span>Recomendado</span><strong>' + ui.num(r.gramos, 0) + ' g</strong></div>' +
          '<div><span>Máximo</span><strong>' + ui.num(r.gramos_max, 0) + ' g</strong></div>' +
        '</div>' +
        '<p style="font-size:.82rem;margin-top:18px">Objetivo: <strong>' + ui.esc(r.objetivo) + '</strong></p>' +
      '</div>';
  }

  function plantillaVacia() {
    return '<div class="panel resultado-vacio">' +
      '<span class="icono">◎</span>' +
      '<p>Completá el peso y elegí un objetivo para ver el resultado.</p>' +
      '</div>';
  }

  /* ======================================================================
     HISTORIAL
     Se guarda a través de la capa de datos, en la colección "calculos".
     Cualquier visitante puede guardar un cálculo sin iniciar sesión, pero
     BORRAR el historial requiere sesión: así nadie puede vaciarlo desde
     afuera. Es una regla de la base de datos, no de esta pantalla.
     ====================================================================== */

  function guardar(r) {
    LZ.store.crear('calculos', r).then(function () {
      dibujarHistorial();
    }).catch(function () {
      /* El resultado ya está en pantalla: que no se pueda guardar el
         historial no invalida el cálculo, así que solo se avisa. */
      ui.aviso('El resultado es correcto, pero no se pudo guardar en el historial.', 'error');
    });
  }

  function dibujarHistorial() {
    var caja = ui.q('[data-calc="historial"]');
    if (!caja) return;

    LZ.store.listar('calculos').then(function (lista) {
      /* Se muestran los últimos 8, del más nuevo al más viejo */
      var ultimos = lista.slice().sort(function (a, b) {
        return new Date(b.fecha) - new Date(a.fecha);
      }).slice(0, 8);

      var boton = ui.q('[data-calc="borrar-historial"]');
      if (boton) boton.disabled = !ultimos.length;

      if (!ultimos.length) {
        ui.vacio(caja, 'Todavía no hiciste ningún cálculo.');
        return;
      }

      caja.innerHTML = ultimos.map(function (c) {
        return '<div class="historial-item">' +
          '<span class="h-datos"><b>' + ui.num(c.peso, 0) + ' kg</b> · ' + ui.esc(c.objetivo) + '<br>' +
            '<span class="h-fecha">' + ui.fechaHora(c.fecha) + '</span></span>' +
          '<span class="h-valor">' + ui.num(c.gramos, 0) + ' g</span>' +
          '</div>';
      }).join('');
    }).then(explicarDondeSeGuarda);
    /* La nota se vuelve a escribir DESPUÉS de leer: recién en ese momento se
       sabe si la base contestó o si hubo que mostrar la copia guardada.
       Preguntarlo antes daría un cartel optimista y equivocado. */

    prepararBotonBorrar();
  }

  function prepararBotonBorrar() {
    var borrar = ui.q('[data-calc="borrar-historial"]');
    if (!borrar || borrar.dataset.listo) return;
    borrar.dataset.listo = '1';

    borrar.addEventListener('click', function () {
      if (!window.confirm('¿Borrar todo el historial de cálculos?')) return;

      borrar.disabled = true;

      LZ.store.listar('calculos').then(function (lista) {
        /* Promise.all lanza todos los borrados a la vez y espera a que
           terminen todos. Si uno falla, cae al catch de abajo. */
        return Promise.all(lista.map(function (c) {
          return LZ.store.eliminar('calculos', c.id);
        }));
      }).then(function () {
        ui.aviso('Historial borrado.');
        dibujarHistorial();
      }).catch(function () {
        ui.aviso('Para borrar el historial hay que iniciar sesión en el panel de administración.', 'error');
        borrar.disabled = false;
      });
    });
  }

  /* Aclara debajo del historial de dónde salen los datos, para que no haya
     dudas de si el cálculo quedó guardado en la base o solo acá. */
  function explicarDondeSeGuarda() {
    var nota = ui.q('[data-calc="nota-historial"]');
    if (!nota) return;

    LZ.store.estado().then(function (e) {
      if (e.conectado) {
        nota.textContent = 'Los cálculos se guardan en la base de datos: se ven desde cualquier computadora.';
      } else if (e.respaldo) {
        nota.textContent = 'Sin conexión con la base de datos. Los cálculos se guardan solo en esta computadora.';
      } else {
        nota.textContent = 'Los cálculos quedan guardados en este navegador.';
      }
    });
  }

})();
