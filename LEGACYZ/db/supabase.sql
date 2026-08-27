-- ==========================================================================
-- LEGACYZ — Base de datos completa (Supabase / PostgreSQL)
-- Calculadora de Requerimiento de Proteína
-- LEGACYZ — 2026
--
-- QUÉ ES ESTE ARCHIVO
-- Todo lo que hay que ejecutar para dejar la base lista desde cero. Ya está
-- aplicado en el proyecto que usa el sitio; queda acá para poder rehacerlo
-- en otro proyecto de Supabase, o para leer cómo está armada la base.
--
-- CÓMO USARLO
--   1. Entrar al proyecto de Supabase → SQL Editor → New query.
--   2. Pegar este archivo completo y ejecutar (Run).
--   3. Authentication › Users → Add user → crear el usuario del panel,
--      con "Auto Confirm User" tildado.
--   4. Authentication › Sign In / Providers › Email → DESACTIVAR
--      "Allow new users to sign up". Sin este paso, cualquiera que vea la
--      clave pública del sitio puede crearse una cuenta y editar el
--      contenido.
--   5. En assets/js/nucleo/config.js: completar url y clavePublica, y dejar
--      backend: 'auto'.
--
-- Los nombres de tablas y columnas coinciden exactamente con los que usa
-- store.js, así que no hay que tocar el código JavaScript.
-- ==========================================================================


-- ==========================================================================
-- 1. IDENTIDAD DEL SITIO
-- Una sola fila, con id = 1. El CHECK garantiza que no se pueda crear una
-- segunda: el sitio tiene una sola marca.
-- ==========================================================================

create table if not exists public.sitio (
  id           integer primary key default 1,
  marca        text not null default 'LEGACYZ',
  slogan       text,
  producto     text,
  descripcion  text,
  anio         text,
  email        text,

  -- Datos del botón "Colaborar" del pie. Mientras estén vacíos, el bloque
  -- no se muestra en ninguna página (lo decide script.js).
  --   donacion_url    link de pago (Mercado Pago u otro). Debe empezar con https://
  --   donacion_alias  alias o CVU para transferir
  --   donacion_texto  texto del botón; si queda vacío se usa uno por defecto
  donacion_url    text,
  donacion_alias  text,
  donacion_texto  text,
  constraint sitio_fila_unica check (id = 1)
);


-- ==========================================================================
-- 2. DATOS RÁPIDOS DE LA PORTADA
-- ==========================================================================

create table if not exists public.metricas (
  id        bigserial primary key,
  valor     text not null,
  etiqueta  text not null,
  orden     integer default 0
);


-- ==========================================================================
-- 3. EQUIPO
-- ==========================================================================

create table if not exists public.equipo (
  id      bigserial primary key,
  nombre  text not null,
  rol     text,
  aporte  text,
  foto    text,                -- dirección pública del bucket "fotos"
  orden   integer default 0
);


-- ==========================================================================
-- 4. COMPONENTES DE HARDWARE
-- ==========================================================================

create table if not exists public.componentes (
  id         bigserial primary key,
  nombre     text not null,
  funcion    text,
  pines      text,
  cantidad   integer default 1,
  categoria  text,
  orden      integer default 0
);


-- ==========================================================================
-- 5. GALERÍA
-- ==========================================================================

create table if not exists public.galeria (
  id           bigserial primary key,
  categoria    text not null,
  titulo       text not null,
  descripcion  text,
  url          text,           -- dirección pública del bucket "fotos"
  orden        integer default 0
);


-- ==========================================================================
-- 6. BITÁCORA DEL PROCESO
-- ==========================================================================

create table if not exists public.bitacora (
  id      bigserial primary key,
  fecha   date not null,
  titulo  text not null,
  texto   text,
  orden   integer default 0
);


-- ==========================================================================
-- 7. FACTORES DE PROTEÍNA
-- El CHECK obliga a que el rango tenga sentido: el mínimo positivo, el
-- máximo no menor que el mínimo, y el valor usado dentro del rango.
-- ==========================================================================

create table if not exists public.factores (
  id              bigserial primary key,
  clave           text unique,
  nombre          text not null,
  descripcion     text,
  min             numeric(4,2) not null,
  max             numeric(4,2) not null,
  medio           numeric(4,2) not null,
  tecla           text,                    -- tecla del dispositivo ('' si no está)
  en_dispositivo  boolean default false,
  orden           integer default 0,
  constraint factores_rango_valido check (min > 0 and max >= min and medio between min and max)
);


-- ==========================================================================
-- 8. HISTORIAL DE CÁLCULOS
-- Esta es la única tabla donde puede escribir alguien SIN iniciar sesión,
-- porque la calculadora la usa cualquier visitante. Por eso lleva CHECK:
-- acotan qué se puede guardar y evitan que se llene de datos absurdos.
-- ==========================================================================

create table if not exists public.calculos (
  id          bigserial primary key,
  peso        numeric(5,1) not null,
  objetivo    text,
  factor_id   bigint references public.factores(id) on delete set null,
  factor      numeric(4,2),
  gramos      numeric(6,1),
  gramos_min  numeric(6,1),
  gramos_max  numeric(6,1),
  fecha       timestamptz default now(),
  constraint calculos_peso_razonable   check (peso between 1 and 300),
  constraint calculos_factor_razonable check (factor is null or factor between 0.5 and 3.0),
  constraint calculos_gramos_positivos check (gramos is null or gramos >= 0),
  constraint calculos_objetivo_corto   check (objetivo is null or char_length(objetivo) <= 80)
);

-- Índices: aceleran las consultas que el sitio hace más seguido.
-- El historial se lee siempre ordenado por fecha, y factor_id necesita índice
-- porque es una clave foránea: sin él, borrar un factor obliga a recorrer
-- toda la tabla de cálculos para ver quién lo estaba usando.
create index if not exists calculos_fecha_idx     on public.calculos (fecha desc);
create index if not exists calculos_factor_id_idx on public.calculos (factor_id);

-- NOTA: no hay índice por categoría en "galeria" a propósito. El filtro de
-- la galería lo hace el navegador sobre la lista ya descargada (son nueve
-- fotos), así que un índice ahí nunca se usaría y solo haría más lenta cada
-- escritura.


-- ==========================================================================
-- 9. SEGURIDAD, PARTE 1 — Row Level Security (RLS)
--
-- El RLS decide, fila por fila, quién puede ver y quién puede modificar.
-- La regla del sitio es simple:
--     LEER   el contenido → cualquier visitante, sin iniciar sesión
--     EDITAR el contenido → solo con la sesión iniciada (el panel)
--
-- "anon" es el visitante sin sesión; "authenticated", quien inició sesión.
-- ==========================================================================

alter table public.sitio       enable row level security;
alter table public.metricas    enable row level security;
alter table public.equipo      enable row level security;
alter table public.componentes enable row level security;
alter table public.galeria     enable row level security;
alter table public.bitacora    enable row level security;
alter table public.factores    enable row level security;
alter table public.calculos    enable row level security;

-- ---------- Lectura pública del contenido ----------
-- Estas políticas nombran solo a "anon", el visitante sin sesión.
-- Quien inició sesión NO necesita figurar acá: su política de escritura, que
-- está más abajo, es "for all", y "all" incluye también el SELECT. Si se lo
-- agregara igual, Postgres evaluaría dos políticas en cada consulta en vez
-- de una, sin ganar nada.
create policy "sitio_lectura"       on public.sitio       for select to anon using (true);
create policy "metricas_lectura"    on public.metricas    for select to anon using (true);
create policy "equipo_lectura"      on public.equipo      for select to anon using (true);
create policy "componentes_lectura" on public.componentes for select to anon using (true);
create policy "galeria_lectura"     on public.galeria     for select to anon using (true);
create policy "bitacora_lectura"    on public.bitacora    for select to anon using (true);
create policy "factores_lectura"    on public.factores    for select to anon using (true);

-- ---------- Edición del contenido: solo con sesión ----------
create policy "sitio_escritura"       on public.sitio       for all to authenticated using (true) with check (true);
create policy "metricas_escritura"    on public.metricas    for all to authenticated using (true) with check (true);
create policy "equipo_escritura"      on public.equipo      for all to authenticated using (true) with check (true);
create policy "componentes_escritura" on public.componentes for all to authenticated using (true) with check (true);
create policy "galeria_escritura"     on public.galeria     for all to authenticated using (true) with check (true);
create policy "bitacora_escritura"    on public.bitacora    for all to authenticated using (true) with check (true);
create policy "factores_escritura"    on public.factores    for all to authenticated using (true) with check (true);

-- ---------- Historial de cálculos ----------
-- Insertar sin sesión (lo hace la calculadora); borrar, solo con sesión.
create policy "calculos_lectura"   on public.calculos for select to anon, authenticated using (true);
create policy "calculos_insercion" on public.calculos for insert to anon, authenticated with check (true);
create policy "calculos_borrado"   on public.calculos for delete to authenticated using (true);


-- ==========================================================================
-- 10. SEGURIDAD, PARTE 2 — Permisos mínimos (defensa en profundidad)
--
-- Por defecto, Supabase le da permiso de escritura sobre todas las tablas a
-- los dos roles públicos, y lo único que frena la escritura son las
-- políticas de arriba. Como la clave pública del sitio queda a la vista en
-- config.js, le sacamos además el permiso al rol anónimo.
--
-- Así, aunque alguien se equivoque más adelante escribiendo una política,
-- un visitante sin sesión sigue sin poder tocar el contenido.
--
-- TRUNCATE se saca en todos los casos porque NO respeta las políticas de
-- RLS: es la única operación que podría vaciar una tabla igual.
-- ==========================================================================

revoke insert, update, delete, truncate on
  public.sitio, public.metricas, public.equipo, public.componentes,
  public.galeria, public.bitacora, public.factores, public.calculos
  from anon;

-- La calculadora sí necesita guardar el historial sin sesión iniciada
grant insert on public.calculos to anon;

revoke truncate on
  public.sitio, public.metricas, public.equipo, public.componentes,
  public.galeria, public.bitacora, public.factores, public.calculos
  from authenticated;


-- ==========================================================================
-- 11. ALMACENAMIENTO DE FOTOS
-- Bucket público "fotos": las imágenes del equipo y de la galería se suben
-- desde admin.html y se guardan como dirección pública en las tablas.
--     Ver   → cualquiera (el sitio es público)
--     Subir → solo con sesión iniciada
-- Límite de 5 MB por archivo y solo formatos de imagen.
-- ==========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "fotos_ver_publico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'fotos');

create policy "fotos_subir_autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos');

-- Reemplazar una foto necesita UPDATE además de INSERT
create policy "fotos_reemplazar_autenticado"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos')
  with check (bucket_id = 'fotos');

create policy "fotos_borrar_autenticado"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos');


-- ==========================================================================
-- 12. CONTENIDO INICIAL
-- Es el mismo contenido que está en data.js.
-- ==========================================================================

-- Los tres campos de donación quedan a propósito sin cargar: se completan
-- desde admin.html › Identidad, para no dejar datos de cobro escritos en un
-- archivo que está publicado en GitHub.
insert into public.sitio (id, marca, slogan, producto, descripcion, anio, email)
values (1,
  'LEGACYZ',
  'Marcando la diferencia desde el inicio',
  'Calculadora de Requerimiento de Proteína',
  'Un dispositivo autónomo que calcula en segundos cuánta proteína necesita una persona por día, sin celular, sin aplicación y sin conexión a internet.',
  '2026',
  'legacyzsuplementos@gmail.com')
on conflict (id) do nothing;

insert into public.metricas (valor, etiqueta, orden) values
  ('5',   'Integrantes del equipo',    1),
  ('6',   'Componentes de hardware',   2),
  ('3',   'Estados del programa',      3),
  ('10s', 'Para obtener el resultado', 4);

insert into public.equipo (nombre, rol, aporte, foto, orden) values
  ('Cornejo Nahuel',    'Programación y desarrollo web', 'Escribió la máquina de estados del programa Arduino y desarrolló este sitio con HTML, CSS y JavaScript.', '', 1),
  ('Duarte Mateo',      'Diseño del circuito',           'Diseñó el esquema de conexiones y resolvió el mapeo de filas y columnas del teclado matricial.',          '', 2),
  ('Godoy Alan',        'Modelado 3D y gabinete',        'Modeló e imprimió el gabinete que sostiene la pantalla y el teclado en una sola pieza.',                  '', 3),
  ('Irigoitia Tiziano', 'Pruebas e integración',         'Probó el dispositivo con distintos pesos y objetivos, y detectó los errores de la primera versión.',      '', 4),
  ('Neris Braian',      'Documentación y contenido',     'Investigó los factores de proteína, armó la bitácora del proceso y escribió los textos del sitio.',       '', 5);

insert into public.componentes (nombre, funcion, pines, cantidad, categoria, orden) values
  ('Arduino UNO R3',            'Microcontrolador principal: guarda el programa, lee el teclado y calcula el resultado.',           '—',                                1,  'Control',      1),
  ('Pantalla LCD 16x2 con I2C', 'Muestra el menú, el peso ingresado y el resultado final. El módulo I2C reduce de 6 cables a 2.',   'SDA → A4 · SCL → A5',              1,  'Salida',       2),
  ('Teclado matricial 4x4',     'Única entrada del sistema: selecciona el objetivo, escribe el peso, confirma y reinicia.',         'Filas 9-8-7-6 · Columnas 5-4-3-2', 1,  'Entrada',      3),
  ('Protoboard 830 puntos',     'Soporte del circuito y distribución de alimentación de 5V y GND.',                                 '—',                                1,  'Soporte',      4),
  ('Cables jumper macho-macho', 'Conexiones entre el Arduino, el teclado y la pantalla.',                                           '—',                                16, 'Conexión',     5),
  ('Cable USB tipo B',          'Carga el programa desde la computadora y alimenta la placa.',                                      '—',                                1,  'Alimentación', 6),
  ('Batería 9V con conector',   'Alimentación autónoma para usar el dispositivo sin computadora en la exposición.',                 'Jack DC',                          1,  'Alimentación', 7);

insert into public.galeria (categoria, titulo, descripcion, url, orden) values
  ('Construcción', 'Primer prototipo en protoboard',   'Arduino, pantalla y teclado conectados por primera vez para probar la comunicación I2C.', '', 1),
  ('Construcción', 'Prueba de la dirección I2C',       'Barrido de direcciones hasta encontrar la del módulo de la pantalla.',                    '', 2),
  ('Construcción', 'Gabinete impreso en 3D',           'Pieza que sostiene la pantalla y el teclado alineados.',                                  '', 3),
  ('Circuito',     'Conexiones del teclado matricial', 'Las cuatro filas a los pines 9 a 6 y las cuatro columnas a los pines 5 a 2.',             '', 4),
  ('Circuito',     'Bus I2C de la pantalla',           'Solo cuatro cables: GND, VCC, SDA y SCL.',                                                '', 5),
  ('Circuito',     'Circuito terminado',               'Cableado ordenado y etiquetado antes de cerrar el gabinete.',                             '', 6),
  ('Funcionando',  'Menú de selección',                'La pantalla mostrando las tres opciones de objetivo.',                                    '', 7),
  ('Funcionando',  'Ingreso del peso',                 'Escribiendo 70 kg con el teclado matricial.',                                             '', 8),
  ('Funcionando',  'Resultado en pantalla',            '126 gramos diarios para 70 kg con factor de hipertrofia.',                                '', 9);

insert into public.bitacora (fecha, titulo, texto, orden) values
  ('2026-04-08', 'Elección del tema',             'El equipo buscaba un proyecto útil y medible. Partimos de una pregunta concreta: ¿cuánta proteína necesita una persona por día? La respuesta existe y es una multiplicación, pero casi nadie la tiene a mano.', 1),
  ('2026-04-22', 'Investigación de los factores', 'Buscamos los rangos de gramos por kilo de peso para cada estilo de vida y definimos un valor medio por categoría, para que el dispositivo devuelva un número único y no un rango.',                       2),
  ('2026-05-13', 'Primer circuito en protoboard', 'Conectamos la pantalla LCD por I2C y el teclado matricial. La pantalla encendía pero no mostraba caracteres: la dirección del módulo era 0x27 y no la que habíamos supuesto.',                            3),
  ('2026-06-03', 'La máquina de estados',         'Reescribimos el programa con tres estados en lugar de una sola secuencia larga. Con SELECCION_MENU, INGRESO_PESO y MOSTRAR_RESULTADO el código quedó más corto y dejó de mezclar pasos.',                 4),
  ('2026-06-24', 'Gabinete y pruebas',            'Imprimimos el gabinete en 3D y probamos el dispositivo con pesos de 1, 2 y 3 dígitos. Limitamos la entrada a 3 dígitos para que el texto nunca desborde las 16 columnas de la pantalla.',                 5),
  ('2026-08-05', 'Versión web del sistema',       'Llevamos la misma lógica al navegador: la calculadora con las cinco categorías y un simulador que reproduce la pantalla y el teclado, para poder mostrar el proyecto incluso sin el hardware sobre la mesa.', 6);

insert into public.factores (clave, nombre, descripcion, min, max, medio, tecla, en_dispositivo, orden) values
  ('sedentario',    'Sedentario',           'Poca o nula actividad física',              0.8, 1.0, 0.90, '1', true,  1),
  ('activo',        'Activo',               'Ejercicio moderado, 3 a 5 días por semana', 1.2, 1.5, 1.35, '',  false, 2),
  ('adulto-mayor',  'Adulto mayor',         'Esencial para evitar la pérdida muscular',  1.5, 2.0, 1.75, '',  false, 3),
  ('atleta',        'Atleta / Hipertrofia', 'Objetivo de ganar masa muscular',           1.6, 2.2, 1.90, '2', true,  4),
  ('perdida-grasa', 'Pérdida de grasa',     'Protege el músculo en déficit calórico',    1.8, 2.4, 2.10, '3', true,  5)
on conflict (clave) do nothing;
