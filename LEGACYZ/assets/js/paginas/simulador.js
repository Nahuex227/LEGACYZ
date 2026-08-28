/* ==========================================================================
   LEGACYZ — simulador.js
   Reproduce en el navegador el funcionamiento real del dispositivo.

   Es la misma máquina de estados del programa Arduino:
     SELECCION_MENU  →  INGRESO_PESO  →  MOSTRAR_RESULTADO
   con la pantalla LCD de 16 columnas x 2 filas y el teclado matricial 4x4.

   Sirve para dos cosas: mostrar el proyecto aunque el hardware no esté
   sobre la mesa, y dejar ver por dentro lo que hace el programa (el estado
   actual, las variables en memoria y un registro tipo Monitor Serial).
   ========================================================================== */

(function () {
  'use strict';

  var ui = LZ.ui;

  /* Las tres opciones que caben en el dispositivo, con el mismo factor
     medio que usa el código C++ (ver tecnica.html) */
  var OPCIONES = {
    1: { nombre: 'Sedentario', textoLcd: 'Modo: Sedentario', factor: 0.9 },
    2: { nombre: 'Atleta',     textoLcd: 'Modo: Atleta',     factor: 1.9 },
    3: { nombre: 'Déficit',    textoLcd: 'Modo: Deficit',    factor: 2.1 }
  };

  var ESTADOS = ['SELECCION_MENU', 'INGRESO_PESO', 'MOSTRAR_RESULTADO'];

  /* Variables del programa, con los mismos nombres que en el Arduino */
  var estadoActual = 'SELECCION_MENU';
  var opcionSeleccionada = 0;
  var factorProteina = 0;
  var stringPeso = '';
  var pesoIngresado = 0;

  var lcd = [];   // dos filas de 16 caracteres

  document.addEventListener('DOMContentLoaded', function () {
    if (!ui.q('[data-sim="lcd"]')) return;
    dibujarTeclado();
    prepararTecladoFisico();
    reiniciar(true);
  });

  /* ======================================================================
     PANTALLA — 32 celdas, como los 32 caracteres de un LCD 16x2
     ====================================================================== */

  function limpiarLcd() {
    lcd = [repetir(' ', 16), repetir(' ', 16)];
  }

  function repetir(caracter, veces) {
    var s = '';
    for (var i = 0; i < veces; i++) s += caracter;
    return s;
  }

  /* Equivalente a lcd.setCursor(columna, fila) + lcd.print(texto).
     Si el texto pasa de la columna 16 se corta, igual que en el LCD real:
     así el simulador muestra el mismo problema que tendría el aparato. */
  function imprimir(columna, fila, texto) {
    var actual = lcd[fila];
    var nuevo = actual.substring(0, columna) + texto;
    lcd[fila] = (nuevo + actual.substring(nuevo.length)).substring(0, 16);
  }

  function pintarLcd(cursorEn) {
    var caja = ui.q('[data-sim="lcd"]');
    caja.innerHTML = lcd.map(function (fila, f) {
      var celdas = '';
      for (var c = 0; c < 16; c++) {
        var esCursor = cursorEn && cursorEn.fila === f && cursorEn.col === c;
        celdas += '<span class="lcd-char' + (esCursor ? ' cursor' : '') + '">' +
                  ui.esc(fila.charAt(c)) + '</span>';
      }
      return '<div class="lcd-fila">' + celdas + '</div>';
    }).join('');
  }

  /* ======================================================================
     PANTALLAS DEL PROGRAMA (las mismas funciones que el código C++)
     ====================================================================== */

  function mostrarMenuInicial() {
    limpiarLcd();
    imprimir(0, 0, '1Sed 2Atl 3Df');
    imprimir(0, 1, 'Elija opcion...');
    pintarLcd(null);
  }

  function pantallaIngresoPeso() {
    limpiarLcd();
    imprimir(0, 0, OPCIONES[opcionSeleccionada].textoLcd);
    imprimir(0, 1, 'Peso:___kg  A=OK');
    /* Los dígitos ya escritos se dibujan sobre los guiones bajos */
    imprimir(5, 1, stringPeso);
    pintarLcd({ fila: 1, col: 5 + stringPeso.length });
  }

  function calcularYMostrarResultado() {
    var gramos = pesoIngresado * factorProteina;
    limpiarLcd();
    imprimir(0, 0, 'Proteina Diaria:');
    imprimir(0, 1, gramos.toFixed(1) + ' g al dia');
    pintarLcd(null);
    registrar('Resultado: ' + pesoIngresado + ' x ' + factorProteina + ' = ' + gramos.toFixed(1) + ' g', true);
  }

  /* ======================================================================
     LÓGICA DEL loop() DE ARDUINO
     Cada estado solo acepta las teclas que tienen sentido: presionar A sin
     haber escrito un peso no hace nada, igual que en el aparato.
     ====================================================================== */

  function pulsar(tecla) {
    animarTecla(tecla);
    registrar('Tecla ' + tecla);

    /* La tecla C reinicia el sistema en cualquier estado */
    if (tecla === 'C') { reiniciar(false); return; }

    if (estadoActual === 'SELECCION_MENU') {
      if (tecla >= '1' && tecla <= '3') {
        opcionSeleccionada = parseInt(tecla, 10);
        factorProteina = OPCIONES[opcionSeleccionada].factor;
        estadoActual = 'INGRESO_PESO';
        registrar('Opcion ' + opcionSeleccionada + ' → factor ' + factorProteina + ' g/kg');
        pantallaIngresoPeso();
      } else {
        registrar('Tecla ignorada en este estado');
      }

    } else if (estadoActual === 'INGRESO_PESO') {
      if (tecla >= '0' && tecla <= '9') {
        if (stringPeso.length < 3) {
          stringPeso += tecla;
          pantallaIngresoPeso();
        } else {
          registrar('Limite de 3 digitos alcanzado');
        }
      } else if (tecla === 'A') {
        if (stringPeso.length > 0) {
          pesoIngresado = parseInt(stringPeso, 10);
          estadoActual = 'MOSTRAR_RESULTADO';
          calcularYMostrarResultado();
        } else {
          registrar('Falta ingresar el peso');
        }
      } else {
        registrar('Tecla ignorada en este estado');
      }

    } else if (estadoActual === 'MOSTRAR_RESULTADO') {
      reiniciar(false);
    }

    actualizarPaneles();
  }

  function reiniciar(inicial) {
    stringPeso = '';
    pesoIngresado = 0;
    factorProteina = 0;
    opcionSeleccionada = 0;
    estadoActual = 'SELECCION_MENU';
    mostrarMenuInicial();
    registrar(inicial ? 'setup(): lcd.init() + backlight()' : 'reiniciarCalculadora()');
    actualizarPaneles();
  }

  /* ======================================================================
     TECLADO 4x4
     ====================================================================== */

  var MATRIZ = [
    ['1', '2', '3', 'A'],
    ['4', '5', '6', 'B'],
    ['7', '8', '9', 'C'],
    ['*', '0', '#', 'D']
  ];

  var NOTAS = { A: 'OK', C: 'Reset' };

  function dibujarTeclado() {
    var caja = ui.q('[data-sim="teclado"]');
    var html = '';

    MATRIZ.forEach(function (fila) {
      fila.forEach(function (t) {
        var fn = NOTAS[t];
        html += '<button type="button" class="tecla' + (fn ? ' tecla--fn' : '') +
          '" data-tecla="' + t + '" aria-label="Tecla ' + t + (fn ? ' (' + fn + ')' : '') + '">' +
          t + (fn ? '<span class="tecla-nota">' + fn + '</span>' : '') +
          '</button>';
      });
    });

    caja.innerHTML = html;
    caja.addEventListener('click', function (e) {
      var boton = e.target.closest('.tecla');
      if (boton) pulsar(boton.getAttribute('data-tecla'));
    });
  }

  /* También se puede usar el teclado real de la computadora */
  function prepararTecladoFisico() {
    document.addEventListener('keydown', function (e) {
      var t = e.key.toUpperCase();
      if (/^[0-9ABCD*#]$/.test(t)) {
        /* Si el visitante está escribiendo en un campo, no interceptamos */
        if (ui.q('input:focus, textarea:focus')) return;
        e.preventDefault();
        pulsar(t);
      }
    });
  }

  function animarTecla(tecla) {
    var boton = ui.qq('.tecla').filter(function (b) {
      return b.getAttribute('data-tecla') === tecla;
    })[0];
    if (!boton) return;

    boton.classList.add('presionada');
    setTimeout(function () { boton.classList.remove('presionada'); }, 110);
  }

  /* ======================================================================
     PANELES DE ESTADO Y VARIABLES
     Muestran por dentro lo que en el aparato real no se puede ver.
     ====================================================================== */

  function actualizarPaneles() {
    var estados = ui.q('[data-sim="estados"]');
    if (estados) {
      estados.innerHTML = ESTADOS.map(function (e) {
        return '<div class="estado-item' + (e === estadoActual ? ' activo' : '') + '">' +
          '<span class="estado-punto"></span>' + e +
          '</div>';
      }).join('');
    }

    var vars = ui.q('[data-sim="variables"]');
    if (vars) {
      vars.innerHTML =
        fila('estadoActual', estadoActual) +
        fila('opcionSeleccionada', opcionSeleccionada) +
        fila('factorProteina', factorProteina.toFixed(2)) +
        fila('stringPeso', '"' + stringPeso + '"') +
        fila('pesoIngresado', pesoIngresado);
    }

    function fila(nombre, valor) {
      return '<div class="variable"><span>' + nombre + '</span><b>' + ui.esc(valor) + '</b></div>';
    }
  }

  /* ======================================================================
     REGISTRO DE ACTIVIDAD (como el Monitor Serial del IDE de Arduino)
     ====================================================================== */

  function registrar(mensaje, esOk) {
    var caja = ui.q('[data-sim="registro"]');
    if (!caja) return;

    var d = new Date();
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    var hora = dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds());

    var linea = document.createElement('div');
    linea.innerHTML = '<span class="r-hora">' + hora + '</span>  ' +
      '<span' + (esOk ? ' class="r-ok"' : '') + '>' + ui.esc(mensaje) + '</span>';
    caja.appendChild(linea);
    caja.scrollTop = caja.scrollHeight;

    /* No dejamos crecer el registro para siempre */
    while (caja.children.length > 120) caja.removeChild(caja.firstChild);
  }

})();
