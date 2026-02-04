# Infraestructura Técnica: Ecosistema BOXROOMER

Este documento detalla los componentes técnicos y servicios externos que sostienen la plataforma BOXROOMER.

## 1. Servidores y Hosting

- **Proveedor**: SiteGround.
- **Entorno**: Servidor único optimizado para WordPress/Static (Public Web) y Node.js/PHP (Backend API).
- **Dominios**:
  - `boxroomer.com` (Web Pública)
  - `app.boxroomer.com` (Área de Cliente)
  - `admin.boxroomer.com` (Torre de Control)

## 2. Capa de Identidad (Auth)

- **Proveedor**: Supabase Auth (GoTrue).
- **Métodos de Acceso**: Email & Password y Google OAuth.
- **Seguridad**: RLS (Row Level Security) activado en todas las tablas sensibles vinculando recursos con `auth.uid()`.

## 3. Capa Financiera (Pagos)

- **Proveedor**: Stripe.
- **Lógica**: SetupIntents para validación de tarjetas y Stripe Billing para suscripciones.
- **Facturación**: Requisito de DNI/CIF obligatorio para cumplimiento legal en España.

## 4. Gestión de Datos y Persistencia

- **Motor Central**: Supabase (PostgreSQL + Real-time Broadcaster).
- **Estrategia Mobile**: PWA con soporte para IndexedDB (en desarrollo).
- **Auditoría**: Tabla `audit_logs` con trazabilidad completa de acciones críticas.

### 4.1. Definición de Tablas (PostgreSQL)

| Tabla | Descripción |
| :--- | :--- |
| `profiles` | Usuarios, roles, datos fiscales y metadatos. |
| `leads_wizard` | Reservas, contratos y estado logístico. Campos extendidos: `operational_incident_type`, `operational_evidence`, `current_trip_count`. |
| `driver_shifts` | Registro de jornadas (inicio/fin) y duración de turnos. |
| `vehicles` | Flota: matrícula, modelo, capacidad, dimensiones y estado. |
| `payments` | Historial de cuotas y transacciones de Stripe. |

### 4.2. Detalle Logística Avanzada

- **Consolidación**: Campos `is_consolidation` y `consolidated_with` en `leads_wizard` para agrupar recogidas.
- **Tracking**: Mapeo dinámico de estados (`pending_pickup`, `confirmed`, `active`) para el Live Tracker.
- **Gestión de Incidencias**: Seguimiento operacional de fallos en el servicio (`operational_incident_type`) con marca de tiempo precisa.
- **Multi-Viaje**: Soporte para servicios que requieren múltiples trayectos entre domicilio y almacén (`current_trip_count`).

## 5. Comunicaciones y Documentos

- **SMTP**: Google Workspace corporativo.
- **PDF**: Generación en cliente vía `jsPDF` para facturas y contratos con firma digital táctil.

## 7. Geolocalización y Logística en Tiempo Real

- **Cálculo de ETA**: Implementado mediante la **Fórmula de Haversine** para medir distancia entre coordenadas (Conductor vs Cliente) y extrapolación de tiempo basada en velocidad media y factor de tráfico Madrid (1.5x).
- **Geocodificación**: Uso de **Nominatim (OpenStreetMap)** para resolución de direcciones a coordenadas lat/lon sin costes de API.
- **Librerías Externas**:
  - `SortableJS`: Motor de arrastre y reordenamiento táctil para la hoja de ruta.
  - `Navigator Geolocation API`: Acceso a la posición GPS del dispositivo móvil del conductor.

## 8. Seguridad y Control de Datos

- **Evidencia Digital**: Almacenamiento de timestamps precisos (`en_route_at`, `pickup_started_at`, `completed_at`) para trazabilidad del servicio.
- **Firma Digital**: Captura de conformidad del cliente en el momento de la recogida mediante canvas táctil (simulado en fase actual).
