# 🎨 Guía de Diseño y Estética - BOXROOMER (2026)

Este documento actúa como la **Fuente de Verdad** para el diseño visual, UI y UX de BOXROOMER.

## 1. Identidad Visual (Colores)

- **Brand Purple**: `#6E44FF` (Púrpura vibrante principal).
- **Brand Dark**: `#0A0A0A` (Fondo modo oscuro profundo).
- **Glassmorphism**: `bg-white/[0.03]` + `backdrop-blur-3xl`.

## 2. Tipografía

- **Títulos**: `Outfit` / `Manrope` (Font-weight: 800+, Italic).
- **Cuerpo**: `Inter` / `Outfit` (Font-weight: 400-600).

## 3. Componentes Elite

- **Sliding Pills**: Efecto de píldora deslizante obligatorio para selecciones de opción única (toggles, tabs).
- **Magnetic Cards**: `transform: translateY(-8px)` en hover para tarjetas de servicio.
- **Iconografía**: Uso exclusivo de **Material Symbols Outlined**.

### Diálogos y Confirmaciones

- **Tracking**: Mapeo dinámico de estados (`pending_pickup`, `confirmed`, `active`) para el Live Tracker.
- **Optimización de Rutas**: Implementación de algoritmos de ordenamiento `route_order` persistentes, permitiendo la secuenciación lógica de paradas desde el almacén central de Pinto.
- **Geonavegación**: Integración con Google Maps para la generación de itinerarios multi-parada (Waypoint routing) partiendo y regresando a la base logística.

- **Adiós al Nativo**: Está terminantemente prohibido usar `confirm()` o `alert()` del navegador.

- **Confirm Modal Premium**:
  - Fondo: `bg-brandDark/80 backdrop-blur-xl`.
  - Cuerpo: Blanco, esquinas `rounded-[2.5rem]`, padding generoso.
  - Iconografía: Uso de iconos de advertencia/peligro en contenedores suaves (ej. `bg-red-50 text-red-500`).
  - Acciones: Botones claros de "Cancelar" y "Acción" con hover escalado.

## 4. Modal Design System

- **Aislamiento**: Backdrop `#0A0510/95` con `backdrop-blur-xl`.
- **Interacción**: Cierre obligatorio por clic en fondo externo y botón `X` superior.
- **Global Scope**: Funciones de control de modales exportadas a `window` para acceso universal desde botones `onclick`.

## 5. Visualización Logística (Torre de Control)

- **Consolidación**: Uso de badges animados (`animate-pulse`) en púrpura con texto "CONSOLIDADO" para rutas agrupadas.
- **Jerarquía**: Resaltado de volumen total (`m3`) en fondo contrastado dentro de las cabeceras de ruta.

## 6. UX Mobile-First

- **Bottom Nav**: Navegación persistente en móvil con indicador fluido.
- **Driver UI**: Contraste extremo (fondo negro/blanco) y botones de gran formato (>64px) para uso operativo.
- **En Camino UI**: Uso de color Naranja (`#F97316`) y animaciones `pulse` para servicios en tránsito.
- **Carga UI**: Uso de color Verde (`#16A34A`) para servicios en proceso de carga activa (cronómetro).

## 9. Sistemas de Control Operativo

- **Barra Big Picture**: Resumen visual en la cabecera de ruta con tres métricas clave: Paradas, Volumen total (m³) y Tiempo estimado de jornada.
- **Gestión de Jornada Contextual**: Eliminación de barras fijas. El control de jornada ('Iniciar/Finalizar') se integra dentro del flujo de 'Mi Ruta' como el primer y último elemento de la lista.
- **Widget de Estado Temporal**: Métrica dinámica (`Iniciada: HH:MM`) situada en el encabezado de sección para control de duración del turno.
- **Feedback Háptico**: Vibración suave (`navigator.vibrate`) obligatoria tras acciones críticas: Guardar cambios, Reportar Incidencia o Confirmar Carga.
- **Evidencia Digital**: Interfaz de "antes y después" con previsualizaciones instantáneas y campo `JSONB` dedicado para documentación fotográfica sincronizada.

## 10. Modo Noche Operativo (Driver Dashboard)

- **Default Theme**: La App del Conductor opera en "modo noche" por defecto para evitar deslumbramientos y ahorrar batería.
- **Paleta de Colores**:
  - Fondo Base: `#0A0510` (Negro Púrpura).
  - Tarjetas: `#1A1525` con borde `rgba(255,255,255,0.05)`.
  - Campos de Entrada: `#252030`.
  - Texto Principal: `#FFFFFF`.
  - Texto Secundario/Atenuado: `#94A3B8`.

## 11. Sistema de Incidencias Operativas

- **Indicadores Visuales**: Las tareas con incidencias activas se marcan con borde rojo vibrante y sombra exterior (`shadow-red-500/10`).
- **Estados de Incidencia**:
  - **Cliente Ausente**: Rojo (`#EF4444`).
  - **Acceso Bloqueado**: Naranja (`#F97316`).
  - **Otros**: Gris/Blanco (`#FFFFFF`).
- **Interacción**: El reporte de incidencia es reversible. Al reportar, se notifica instantáneamente a la base y se queda reflejado con un badge en la tarjeta del conductor.
