# Visión Técnica e Infraestructura: Ecosistema BOXROOMER

Este documento detalla la propuesta técnica para transformar la web actual de BOXROOMER en una plataforma operativa real con área de cliente, panel de administración e integración logística.

## 1. Arquitectura y Stack Tecnológico

Para garantizar escalabilidad, seguridad y rapidez de desarrollo, propongo un stack moderno y profesional:

- **Hosting**: **SiteGround**. Recomendado como servidor único para optimizar costes. Aprovecharemos sus capacidades para la web pública y el backend (vía Node.js o PHP según arquitectura final), eliminando la dependencia de DigitalOcean.
- **Transición**: La web actual se mantendrá **desacoplada**. Podemos alternar entre la App antigua y la nueva mediante una simple configuración de entorno.
- **Autenticación**: **Clerk** o **NextAuth.js**. Validación de email obligatoria y distinción absoluta de roles (Admin/Cliente).
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
- **Seguros**: Base de **1.000€/m³ incluído**. Ampliación opcional en tramos de **500€** con suplemento mensual dinámico.
- **Protocolo de Abandono**: Bloqueo de acceso e inicio de flujo legal tras 30 días de impago.
- **Seguridad en Entrega**: La App captura **Nombre + DNI** del receptor (titular, vecino o portero autorizado) y firma táctil.

## 3. Propuesta de Diseño de Pantallas

### A. Wizard de Contratación "Acompañado" (Split View)

- **Estructura**: Pantalla dividida. Izquierda (formulario), Derecha (ChatBot Copiloto).
- **Paso 1: Configuración**: Carga automática del presupuesto (Pack Mini/Dúo/Personalizado) y confirmación de m³.
- **Paso 2: Logística**: Calendario visual para elegir fecha y hora de recogida. Campo de dirección con autocompletado de Google Maps.
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
  - **Ficha de Bulto**: Al tocar una foto, se abre el detalle con: Foto ampliada, etiquetas del cliente (ej: "Bici"), estado (En almacén/En reparto).
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
- **5. Centro de Configuración**:
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

- **Emailing Premium (Estilo Web)**: Todos los correos tendrán el diseño visual, tipografía (Manrope) y colores de la web.
- **Email T-7 (Transición de Plan)**:
  - **Precios Dinámicos**: Informa de los precios nuevos si ha habido cambios. Calcula el precio exacto para ese cliente basado en su **volumen actual**.
  - **Opciones One-Click**:
    1. *"Continuar mes a mes (Tarifa Base)"*.
    2. *"Ahorrar con Plan 6 meses (Precio X)"*.
    3. *"Máximo ahorro con Plan 12 meses (Precio Y)"*.
    4. *"Solicitar Recuperación TOTAL del espacio"*.
  - Al pulsar, se actualiza el contrato sin login adicional.

## 5. Sincronización SGA (API Ad-Hoc Confirmada)

Integramos el sistema con la **API Ad-Hoc existente** del SGA:

- **Saliente (Web -> SGA)**: Enviaremos órdenes de recogida vía Endpoint dedicado.
- **Entrante (SGA -> Web)**: Recepción de estados ("Bulto Recibido") y enlaces a las fotos del inventario mediante webhook o consumo de API. **Esto activará el reloj de facturación**.

> [!IMPORTANT]
> **Independencia Total**: La web pública que estamos haciendo ahora es 100% independiente de cualquier desarrollo de backend que hagamos después.
>
> - Si decides no avanzar con el plan complejo, los botones de "Reserva" pueden seguir apuntando a tu App antigua sin problemas.
> - No se "romperá" nada por tener este plan diseñado pero no ejecutado.

## 7. Consolidación en SiteGround

Si el objetivo es ahorrar costes eliminando DigitalOcean:

- **Opción A**: Migrar la lógica de la App de DigitalOcean a SiteGround (siempre que la tecnología de la app antigua sea compatible, ej. PHP/Node).
- **Opción B**: Mantener la estática en SiteGround y solo lo imprescindible en DigitalOcean.
- **Option C**: Construir la nueva infraestructura optimizada directamente para el ecosistema de SiteGround.

## 9. Recomendaciones "Pro" (Fase Activa)

1. **Firma Digital (Coste Cero)**: Implementación de un **"Signature Pad" (Lienzo HTML5)** propio. Es **gratis**, sencillo y guardamos la imagen de la firma + IP + Timestamp para validez legal básica.
2. **Motor de Referidos**: Cupón automático de "1 mes gratis" para el recomendador y el recomendado.
3. **Registro de Daños**: Sistema de auditoría fotográfica en el momento de la entrada para evitar reclamaciones.

## 10. Últimos Retoques Críticos

Haciendo un barrido final, estos 3 detalles marcan la diferencia técnica y operativa:

1. **Emailing (Google Workspace)**: ¡Sí! Usaremos tu cuenta corporativa de Google (`@boxroomer.com`) vía **SMTP seguro**.
   - *Ventaja*: Ahorro de costes (ya lo pagas) y centralización.
   - *Límite*: Google permite unos ~2.000 correos/día, que es más que suficiente para empezar. Si crecemos mucho, ya migraremos.
2. **App Offline (PWA)**: Confirmado el modo **"Offline-First"** para conductores. La firma y fotos se guardan en el móvil si están en un sótano sin cobertura y se suben automáticamente al salir.

## 8. Escenarios de Blindaje Operativo e Integración

- **Área de Servicio Inteligente**:
  - **Zona 0 (Tarifa Fija)**: Radio de 20km desde Sol (Madrid) o 20km desde vuestro centro en Pinto.
  - **Zona 1 (Tarifa por Km)**: Resto de la Comunidad de Madrid y territorio nacional. El sistema calcula siempre el kilometraje como **ida y vuelta hasta Pinto**.
  - El Wizard bloqueará o enviará a "Estudio Manual" cualquier código postal que esté fuera de un rango razonable.
- **Gestión de Precios Heredados (Legacy)**: Definición de política al cambiar precios en `/admin`. El sistema permitirá elegir si los clientes antiguos migran al nuevo precio o mantienen su tarifa original (fidelización).
- **Políticas de Suplementos y Mozo Extra**:
  - **Mozo Extra**: No se elige en el Wizard ni por el Driver. Se añade **exclusivamente desde el Panel Admin** tras la llamada de confirmación de fecha/hora, una vez el administrador valide la necesidad con el cliente.
  - **Suplemento por Espera**: Si el transportista llega y el cliente no está listo, tras los 15' de cortesía, la App del Driver permitirá activar un cronómetro de "Tiempo Extra" cobrable.
- **Sin Materiales en Campo**: El transportista NO entrega materiales extra en mano. Todo material debe ser contratado y pagado previamente vía web/admin.
- **Enriquecimiento de Inventario por el Cliente**: El cliente podrá añadir "Notas/Tags" a las fotos (ej: "Ropa de invierno", "Delicados") para que su buscador sea útil.
- **Protocolos Pro ante Conflictos y Pagos**:
  - **Tarjeta de Respaldo**: Si la tarjeta principal falla, el sistema intentará cobrar automáticamente a la segunda tarjeta guardada en el *Wallet* para evitar el bloqueo del servicio.
  - **Recargo por Mora**: Si un recibo queda impagado tras 3 re-intentos automáticos, se aplicará un recargo de **15€** en concepto de "Gestión de Recobro".
  - **Inventario Oficial**: El recuento en domicilio es estimado; el inventario vinculante es el validado en almacén bajo videovigilancia.
  - **Upgrades pro-rata**: Cambio de plan inmediato aplicando descuentos del nuevo plazo.
- **Cupones de Descuento**: El Wizard y el Área de Cliente tendrán un campo de "Cupón" que validará en tiempo real descuentos por importe o porcentaje.
- **Ventana de Reclamación**: Botón de "Incidencia" limitado a las primeras 48h tras la entrega de vuelta.

## 11. Futuro (Roadmap)

- **App PWA**: Instalación directa en móvil (postergado hasta estabilizar infraestructura principal).

## 12. Ejecución Inmediata (Próximos Pasos)

1. **Setup**: Desplegar entorno de pruebas en subdominio de SiteGround.
2. **API Check**: Solicitar documentación de la API Ad-Hoc del SGA.
3. **Frontend**: Maquetar primera versión del Wizard con el Chat-Copiloto.

## 13. ESTADO DE IMPLEMENTACIÓN (MVP FRONTEND COMPLETADO)

*Última actualización: Enero 2026*

Se ha completado la construcción de todas las interfaces clave del ecosistema (MVP Visual). El proyecto está listo para iniciar la fase de integración backend.

### ✅ FASE 1: FRONTEND & UX (HECHO)

#### **Web Pública & Captación**

- [x] **Landing Page**: Optimizada con calculadora de precios.
- [x] **Wizard de Reserva**: Flujo de 3 pasos con autocompletado de dirección (Nominatim), validación de zona y chat copiloto.
- [x] **Sistema de Scroll Inteligente**: Garantizado mediante flexbox (`display: flex`) en todos los pasos para mantener cabeceras fijas y contenido desplazable internamente.
- [x] **Simulación de Pago**: Botón de confirmación funcional (guarda estado en `localStorage`).

#### **Área de Cliente (Fidelización) - Rediseño Premium Dark**

- [x] **Autenticación UI**: Pantallas de `Login` y `Registro` con diseño **Premium Dark** (Glassmorphism avanzado, blobs animados y estética futurista).
- [x] **Dashboard (`/pages/cliente_dashboard.html`)**:
  - **Premium Dark**: Rediseñado para inmersión total con fondos negros profundos y acentos púrpuras.
  - **Diseño Híbrido**: Barra inferior en Móvil ↔ Sidebar Lateral en Escritorio.
  - Status Card dinámica (con datos hidratados desde reserva).
- [x] **Inventario (`/pages/cliente_inventario.html`)**:
  - **Premium Dark**: Galería visual de bultos con efectos de cristal y buscador inteligente.
  - Selección múltiple para recuperaciones parciales.
- [x] **Wallet & Pagos (`/pages/cliente_pagos.html`)**:
  - **Premium Dark**: Gestión de tarjetas y facturación con visuales de alta gama.
  - Descarga de facturas PDF integrada.
- [x] **Cuenta & Perfil (`/pages/cliente_cuenta.html`)**:
  - **Premium Dark**: Settings organizados por categorías con visuales de glassmorphism.
  - Centro de ayuda dinámico integrado con BoxBot.

#### **Torre de Control (Gestión)**

- [x] **Admin Dashboard (`/pages/admin_dashboard.html`)**:
  - Recepción en tiempo real de nuevas reservas (lee del `localStorage` compartido).
  - Grid de KPIs operacionales (Ocupación, MRR, Rutas).
  - Tabla de gestión de pedidos live.
- [x] **Admin Clientes (`/pages/admin_clientes.html`)**:
  - **Buscador Real-time**: Filtrado instantáneo por nombre, DNI, email o ID.
  - **Filtros de Estado**: "Todos", "Activos" (por defecto), "Inactivos", "Impagos" y "P. Llamada".
  - **Modal 360º**: Multi-pestaña para Información Fiscal (DNI/CIF obligatorio), Histórico de Actividad y Centro de Facturación del cliente.
  - **Módulo de Cobro**: Interfaz para emitir cargos manuales (KM, Mozos, etc) contra el Wallet del cliente.
- [x] **Admin Facturación (`/pages/admin_facturacion.html`)**:
  - **Analítica de Ingresos**: Gráfico comparativo 2026 vs 2025 con Chart.js.
  - **Previsión de Cobros**: Listado de transacciones programadas para el mes activo.
  - **Status Financiero**: KPIs de MRR, ARPU e Impagos destacados.

### 🔜 FASE 2: BACKEND & INTEGRACIÓN (PENDIENTE)

1. **Infraestructura de Datos (Supabase/PostgreSQL)**: Migrar `localStorage` a base de datos real.
2. **Autenticación Real (Clerk)**: Implementar protección de rutas.
3. **Pasarela de Pagos (Stripe)**: Conectar botón de pago con Checkout real.
4. **Logística Inteligente**: Refinar cálculo de rutas y zonas.
5. **PDF System**: Conectar con datos dinámicos del servidor para facturación oficial.
