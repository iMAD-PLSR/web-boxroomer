# Visión Técnica e Infraestructura: Ecosistema BOXROOMER

Este documento detalla la propuesta técnica para transformar la web actual de BOXROOMER en una plataforma operativa real con área de cliente, panel de administración e integración logística.

## 1. Arquitectura y Stack Tecnológico

Para garantizar escalabilidad, seguridad y rapidez de desarrollo, propongo un stack moderno y profesional:

- **Hosting**: **SiteGround**. Recomendado como servidor único para optimizar costes. Aprovecharemos sus capacidades para la web pública y el backend (vía Node.js o PHP según arquitectura final), eliminando la dependencia de DigitalOcean.
- **Transición**: La web actual se mantendrá **desacoplada**. Podemos alternar entre la App antigua y la nueva mediante una simple configuración de entorno.
- **Autenticación**: **Supabase Auth**. Validación de email obligatoria y distinción absoluta de roles (Admin/Cliente) basada en metadatos y RLS.
- **Pasarela de Pagos**: **Stripe Billing**. Almacenamiento PCI-compliant de tarjetas para cobros recurrentes y cargos manuales.

## 2. Lógica Logística y Facturación

1. **El Reloj de Suscripción**: Los 3/6/12 meses empiezan a contar cuando el SGA confirma la **entrada física** en almacén vía Webhook.
2. **Pre-autorización**: Registro de tarjeta en el Wizard (Pase de 0€ vía SetupIntents).
3. **Política de Packs y Entregas**:
   - **Contenido**: Los Packs van a precio y volumen cerrado. No cambian automáticamente por recuperaciones parciales.
   - **Entrega Incluida**: Se incluye **UNA única entrega total** (recuperación final) al terminar el plan.
   - **Entregas Parciales**: Cualquier devolución de bultos durante el plan tendrá un coste de **39€** (Zona 0) y el cliente será advertido.
4. **Política de Cancelación**:
   - **Cargo de Gestión**: **39€** si se cancela tras la reserva.
   - **Packs**: Se retiene el primer mes como reserva de espacio y gestión.
5. **Salida Anticipada (Liquidación)**: Si el cliente solicita la recuperación TOTAL antes de finalizar su plan (3/6/12 meses), el sistema calculará las cuotas restantes hasta el cumplimiento del contrato.
   - **Acción**: El asistente informará del importe de liquidación y, si el cliente confirma, se ejecutará el cobro íntegro antes de autorizar la orden de transporte. No se programa la entrega hasta que la deuda del plan esté a cero.

## 3. Gestión de Escenarios Especiales

- **Logística "En Centro Logístico" (Pinto)**:
  - **Entrega por el Cliente (Inicio)**: El cliente puede traer sus bultos a Pinto personalmente. Coste: **0€**.
  - **Recogida por el Cliente (Fin)**: El cliente puede venir a recoger sus bultos. Coste de gestión: **39€**. Se requerirá Identificación vía número de pedido y código de barras/QR generado por el sistema.
- **Seguros**: Base de **1.000€/m³ incluído** automáticamente en todos los planes. El área de cliente mostrará la cobertura total dinámica basada en el volumen ocupado actual.
- **Auditoría de Recepción SGA**: Al recibir los bultos en almacén, el SGA envía los datos de auditoría (integridad, fecha de entrada) que se muestran en el detalle de cada objeto para total transparencia.
- **Protocolo de Abandono**: Bloqueo de acceso e inicio de flujo legal tras 30 días de impago.
- **Seguridad en Entrega**: La App captura **Nombre + DNI** del receptor (titular, vecino o portero autorizado) y firma táctil.

## 4. Propuesta de Diseño de Pantallas

### A. Wizard de Contratación "Acompañado" (Split View)

- **Estructura**: Pantalla dividida. Izquierda (formulario), Derecha (ChatBot Copiloto).
- **Paso 1: Configuración**: Carga automática del presupuesto (Pack Mini/Dúo/Personalizado) y confirmación de m³.
- **Paso 2: Logística**: Calendario visual para elegir fecha y hora de recogida. Campo de dirección con autocompletado de **Nominatim (OpenStreetMap)**.

- **Paso 3: Tienda Materiales**: Selector de cajas con pago inmediato en el **Checkout**. Por defecto, la entrega de cajas vacías se realiza el mismo día de la recogida (evitando viaje extra de 39€).
- **Paso 4: Legal & Pago**: Firma digital y pago de materiales + reserva.
- **El Copiloto (BoxBot)**: El bot reacciona en tiempo real. Si el usuario selecciona "Pack Mini", el bot dice: *"Genial, con este pack tienes 10 cajas incluidas. ¿Quieres que te las enviemos mañana?"*.

### B. Área Privada de Cliente (/app) - "Tu Trastero en el Bolsillo"

- **Layout**: Menú inferior persistente (Home, Inventario, Pagos, Ayuda) optimizado para móvil.
- **Home (Estado Vital)**:
  - Card superior dinámica: *"Tu servicio está en tránsito"* o *"Tus 12 bultos están seguros en Pinto"*.
  - Botones de acción rápida: "Pedir algo de vuelta" / "Añadir más cosas".
- **Gestión de Inventario (Catálogo Interactivo)**:
  - **Grid Visual**: Lista de fotos HD recibidas del SGA.
  - **Ficha de Bulto**: Al tocar una foto, se abre el detalle con: Foto ampliada, **Datos de Auditoría SGA** (fecha entrada, integridad), etiquetas manuales de usuario (ej: "Bici"), estado (En almacén/En reparto).
- **Cobertura Dinámica**: Widget informativo que calcula el seguro total (m³ x 1.000€) para dar visibilidad al valor añadido del servicio.
- **Solicitud de Recuperación (Carrito de Vuelta)**:
  - **Paso 1**: Selector múltiple de bultos.
  - **Paso 2 (Lógica Pro)**: Si se seleccionan TODOS los bultos y el plan no ha terminado, salta aviso dinámico: *"Aún te quedan X meses de tu plan. Al recuperar todo ahora, se procederá a la liquidación de Y€"*.
  - **Paso 3**: Elegir Dirección + Pago de Gestión (39€) + Liquidación de meses restantes (si aplica).
  - **Paso 4**: Confirmación y generación de orden logística.
- **Sección Wallet & Documentos**:
  - Listado de tarjetas (Stripe Cards).
  - Listado de facturas PDF descargables y contrato firmado.
- **Actividad (Activity Log)**: Timeline visual de cada movimiento realizado desde la contratación.

### C. Panel de Administración (/admin) - "Torre de Control"

- **Layout Profesional**: Barra de navegación lateral (**Sidebar**) con acceso a: Dashboard, Clientes, Servicios Activos, Facturación y Ajustes.
- **1. Dashboard Principal (Métricas de Negocio)**:
  - KPI Cards: Ocupación de almacén (%), MRR (Ingresos recurrentes), Pedidos Pendientes Hoy.
  - Gráfico de "Entradas vs Salidas" mensual.
- **2. Listado Maestro de Clientes (Agilidad)**:
  - Tabla dinámica con filtros rápidos: "Morosos", "Próxima renovación", "Nuevos hoy".
  - Buscador global por Nombre, DNI o Email.
- **3. Ficha 360º del Cliente (Visión Total)**:
  - **Estado Vital**: Badge de color (Verde: Al día / Rojo: Impago / Ámbar: En proceso / Naranja: Pendiente Llamada).
  - **DNI/CIF Obligatorio**: Requisito indispensable para la generación de facturas y cumplimiento legal.
  - **Timeline de Servicio**: Cronograma visual de hitos (Contrató el 12/01, Recogida el 14/01, Fotos subidas el 15/01...).
  - **Gestión Financiera & Invoicing**:
    - Historial completo de facturas PDF emitidas.
    - Botón de "Cobro Manual" (abre modal para km extra, mozo fuera de radio, cajas extra, o gastos de cancelación).
    - Botón de "Devolución" (Stripe Refund directo).
- **4. Facturación Avanzada (Live Analytics)**:
  - **Dash de MRR & Ingresos**: Gráficas comparativas de ingresos mensuales (Año Actual vs Año Anterior) con cálculo automático de % de crecimiento.
  - **Próximas Transacciones**: Listado de cobros programados para el mes en curso (Suscripciones Stripe).
  - **Control de Mora**: Identificación visual inmediata de clientes en estado de "Impago".
- **5. Gestión de Servicios (Post-Llamada)**:
  - **Confirmación Logística**: Vista de pedidos "Pendientes de Llamada". Al cerrar fecha y hora con el cliente, el admin:
    - Asigna fecha/hora definitiva.
    - **Añade Suplementos (Mozo Extra)**: Selector específico para añadir el coste de 35€ si se detecta la necesidad durante la conversación.
    - **Generación de Orden**: Al guardar, se notifica al cliente y se emite el cargo/factura correspondiente.
- **6. Centro de Configuración**:
  - Gestor de Cupones, Editor de Precios y Tramos de Seguros.
  - **Audit Log Técnico**: Registro de quién del staff tocó qué y cuándo.

### D. Web App Transportista (/driver) - "Operativa de Campo"

*Diseño Mobile-First extremo (botones gigantes, alto contraste).*

- **Ruta del Día**: Lista ordenada de paradas (Recogidas/Entregas) con botón de "Navegar" (abre Waze/Google Maps).
- **Control de Tiempos (Facturación por Mozo)**:
  - El conductor solo introduce la **"Hora de Inicio de Trabajo"**.
  - La App calcula automáticamente la duración total hasta la "Hora de Finalización" actual.
  - **Cálculo Automático**: Descuenta los **15 min de cortesía** iniciales y divide el resto en **bloques de 15 min** facturables. El importe se carga directo a la tarjeta tras la firma.
- **Proceso de Entrega/Recogida**:
  - **Validación Ágil**: Conteo rápido de bultos ("Recogidos: 15"). Sin escaneos complejos en domicilio.
  - **Firma e Identificación**: Captura de **Nombre Completo + DNI** del receptor y firma táctil en pantalla.
  - **Gestión de Incidencias**: Subida de foto en caso de "Servicio Fallido" (dispara cargo automático de 39€ + km ida/vuelta si aplica).

## 5. Sincronización SGA (API Ad-Hoc Confirmada)

Integramos el sistema con la **API Ad-Hoc existente** del SGA:

- **Saliente (Web -> SGA)**: Enviaremos órdenes de recogida vía Endpoint dedicado.
- **Entrante (SGA -> Web)**: Recepción de estados ("Bulto Recibido") y enlaces a las fotos del inventario mediante webhook o consumo de API. **Esto activará el reloj de facturación**.

> [!IMPORTANT]
> **Independencia Total**: La web pública que estamos haciendo ahora es 100% independiente de cualquier desarrollo de backend que hagamos después.
>
> - Si decides no avanzar con el plan complejo, los botones de "Reserva" pueden seguir apuntando a tu App antigua sin problemas.
> - No se "romperá" nada por tener este plan diseñado pero no ejecutado.

## 6. Emailing Premium (SMTP corporativo)

- **Servicio**: Google Workspace (@boxroomer.com) vía SMTP seguro.
- **Diseño**: Todos los correos tendrán el diseño visual, tipografía (Manrope) y colores de la web.
- **Opciones One-Click**: Renovaciones y recuperaciones integradas en el flujo de email.

## 7. Consolidación en SiteGround

Si el objetivo es ahorrar costes eliminando DigitalOcean:

- **Opción A**: Migrar la lógica de la App de DigitalOcean a SiteGround (siempre que la tecnología de la app antigua sea compatible, ej. PHP/Node).
- **Opción B**: Mantener la estática en SiteGround y solo lo imprescindible en DigitalOcean.
- **Option C**: Construir la nueva infraestructura optimizada directamente para el ecosistema de SiteGround.

## 8. Escenarios de Blindaje Operativo e Integración

- **Área de Servicio Inteligente**: Radio de 20km desde Sol/Pinto (Zona 0) y facturación por km para Zona 1.
- **Gestión de Suplementos**: Mozo extra y tiempo de espera gestionados desde Admin/App Driver.
- **Offline-First PWA**: Firma y fotos guardadas localmente en zonas sin cobertura.

## 9. Recomendaciones "Pro" (Fase Activa)

1. **Firma Digital (Coste Cero)**: Lienzo HTML5 propio con captura de metadatos.
2. **Motor de Referidos**: Sistema de cupones automáticos.
3. **Audit Log Técnico**: Trazabilidad completa de acciones administrativas.

---

## 10. ESTADO DE IMPLEMENTACIÓN (MVP COMPLETADO)

*Última actualización: Febrero 2026*

### ✅ FASE 1: FRONTEND & UX (COMPLETO)

- [x] Landing Page & Calculadora.
- [x] Wizard de Reserva (3 pasos + ChatBot).
- [x] Área Cliente Premium Dark (Dashboard, Inventario, Wallet, Cuenta).
- [x] Gestión de Direcciones (Nominatim).
- [x] Torre de Control Admin (Dashboard, Clientes, Logística, Facturación, Ajustes).

### ✅ FASE 2: GESTIÓN DE DATOS & OPERATIVA REAL (COMPLETO)

- [x] Esquema Supabase (Profiles, Leads, Payments, Vehicles).
- [x] Autenticación & RLS Clientes.
- [x] Dashboard Real-time (Sync Broadcaster).
- [x] Facturación PDF Automática.
- [x] Renovaciones & Upgrades de Plan.
- [x] Live Logistics Tracker.
- [x] Portal Driver & Fleet Management.
- [x] **Consolidación Logística Avanzada**: Detección de rutas coincidentes y agrupación visual en Admin.
- [x] **Robustecimiento UI & UX**: Implementación de sistema de confirmación modal premium y eliminación de diálogos nativos para coherencia visual total.
- [x] **Simplificación Logística**: Eliminación de micro-detalles de acceso secundarios (Ascensor, Parking, Portero) para agilizar la reserva y despliegue operativo.
- [x] **Operativa de Campo PRO**: App de conductor con Drag & Drop (SortableJS), ETA dinámico basado en Haversine/Nominatim y sistema de 3 estados (Pendiente, En Camino, Cargando).
- [x] **Control de Calidad Digital**: Módulo de evidencias fotográficas (Pre/Post carga) y botón de reporte de incidencias críticas en tiempo real.
- [x] **Modo Noche & UX de Campo**: Interfaz oscura por defecto para conductores, optimizada para exteriores y fatiga visual, con sistema de navegación por pestañas (Sliding Pill).
- [x] **Gestión Multi-Viaje**: Soporte lógico para servicios de gran volumen que requieren múltiples trayectos al almacén.

### 🚀 PRÓXIMOS PASOS

1. **IndexedDB (Offline-First)**: Persistencia local para la Driver App en zonas de poca cobertura.
2. **Sistema de Firma Real**: Integración de canvas táctil para recolección de firmas en el momento de la entrega.
3. **Logística Predictiva**: Algoritmo de tiempos basado en histórico de tráfico real de Madrid.
4. **Notificaciones Push**: Alerta al dispositivo del conductor cuando se le asigna un nuevo servicio.
