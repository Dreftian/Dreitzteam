-- Vistas en español para el dashboard de InsForge.
-- Las tablas reales conservan nombres en inglés (estándar) para no romper el
-- código. Estas vistas espejan cada tabla con nombres descriptivos en español
-- para inspección manual desde el panel admin.

create or replace view juegos as
select
  id                    as id,
  steam_app_id          as steam_id,
  title                 as titulo,
  short_description     as descripcion_corta,
  developer             as desarrollador,
  publisher             as distribuidor,
  release_date          as fecha_lanzamiento,
  release_at            as lanza_en,
  header_image          as imagen_cabecera,
  capsule_image         as imagen_caja,
  background_image      as imagen_fondo,
  trailer_url           as url_trailer,
  genres                as generos,
  categories            as categorias,
  languages             as idiomas,
  price_initial         as precio_original,
  price_final           as precio_final,
  discount_percent      as porcentaje_descuento,
  discount_ends_at      as descuento_termina_en,
  currency              as moneda,
  stock                 as stock,
  is_featured           as destacado,
  is_active             as activo,
  is_dlc                as es_dlc,
  is_demo               as es_demo,
  is_preorder           as es_preventa,
  drm_platform          as plataforma_drm,
  steam_review_score    as puntaje_steam,
  steam_review_count    as reseñas_steam,
  metacritic_score      as puntaje_metacritic,
  updated_at            as actualizado_en
from games;

create or replace view licencias as
select
  id           as id,
  game_id      as juego_id,
  code         as codigo,
  status       as estado,
  sold_to      as vendida_a,
  sold_at      as vendida_en,
  redeemed_at  as canjeada_en
from licenses;

create or replace view historial_precios as
select
  id                as id,
  game_id           as juego_id,
  price             as precio,
  discount_percent  as porcentaje_descuento,
  recorded_at       as registrado_en
from price_history;

create or replace view paquetes as
select
  id                as id,
  title             as titulo,
  description       as descripcion,
  hero_image        as imagen_principal,
  discount_percent  as porcentaje_descuento,
  starts_at         as inicia_en,
  ends_at           as termina_en,
  is_active         as activo
from bundles;

create or replace view paquete_juegos as
select bundle_id as paquete_id, game_id as juego_id from bundle_games;

create or replace view promociones as
select
  id            as id,
  title         as titulo,
  subtitle      as subtitulo,
  hero_image    as imagen_principal,
  accent_color  as color_acento,
  cta_text      as texto_boton,
  cta_target    as destino_boton,
  starts_at     as inicia_en,
  ends_at       as termina_en,
  priority      as prioridad,
  is_active     as activa
from promotions;

create or replace view promocion_juegos as
select promotion_id as promocion_id, game_id as juego_id from promotion_games;

create or replace view ofertas_flash as
select
  id                as id,
  game_id           as juego_id,
  discount_percent  as porcentaje_descuento,
  max_units         as unidades_max,
  starts_at         as inicia_en,
  ends_at           as termina_en,
  is_daily_deal     as oferta_del_dia
from flash_sales;

create or replace view colecciones as
select
  id            as id,
  slug          as slug,
  title         as titulo,
  description   as descripcion,
  curator_name  as curador,
  hero_image    as imagen_principal
from collections;

create or replace view coleccion_juegos as
select collection_id as coleccion_id, game_id as juego_id, ord as orden from collection_games;

create or replace view pedidos as
select
  id                as id,
  user_local_id     as usuario_id,
  user_username     as usuario_nombre,
  total             as total,
  card_last4        as tarjeta_ultimos4,
  card_brand        as tarjeta_marca,
  payment_provider  as proveedor_pago,
  external_id       as id_externo,
  points_earned     as puntos_ganados,
  points_used       as puntos_usados,
  promo_code        as codigo_promo,
  status            as estado,
  created_at        as creado_en
from orders;

create or replace view pedido_items as
select
  id              as id,
  order_id        as pedido_id,
  game_id         as juego_id,
  license_id      as licencia_id,
  price           as precio,
  title_snapshot  as titulo_snapshot
from order_items;

create or replace view configuracion as
select key as clave, value as valor, updated_at as actualizado_en from app_settings;

-- Comentarios sobre las tablas originales para que aparezcan como tooltip
-- en el dashboard de InsForge.
comment on table games is 'Catálogo principal de juegos (espejo: juegos)';
comment on table licenses is 'Claves/licencias por juego (espejo: licencias)';
comment on table price_history is 'Histórico de precios para gráficos (espejo: historial_precios)';
comment on table bundles is 'Paquetes / bundles con descuento (espejo: paquetes)';
comment on table promotions is 'Banners promocionales (espejo: promociones)';
comment on table flash_sales is 'Ofertas relámpago con stock limitado (espejo: ofertas_flash)';
comment on table collections is 'Colecciones curadas (espejo: colecciones)';
comment on table orders is 'Historial de compras de usuarios (espejo: pedidos)';
comment on table order_items is 'Líneas individuales de cada pedido (espejo: pedido_items)';
comment on table app_settings is 'Configuración global compartida (espejo: configuracion)';
