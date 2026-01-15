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

- **Proveedor**: Clerk.
- **Métodos de Acceso**:
  - Social: Google (Principal), Apple, Microsoft.
  - Passwordless: Magic Links vía Email.
- **Seguridad**: MFA (Multi-Factor) activado obligatoriamente para perfiles Admin.
- **Plan**: Free (hasta 10,000 MAU).

## 3. Capa Financiera (Pagos)

- **Proveedor**: Stripe.
- **Productos**:
  - **Stripe Billing**: Para suscripciones recurrentes (Packs 3/6/12 meses).
  - **Stripe Elements**: Para captura segura de tarjetas en el Wizard.
  - **Stripe Radar**: Prevención de fraude automática.
- **Lógica**: Uso de *SetupIntents* para validación de tarjetas sin cargo inicial.
- **Facturación**: Requisito de DNI/CIF obligatorio para todos los clientes (B2C y B2B) para cumplir con la normativa española de facturación.

## 4. Integración Logística (SGA)

- **Sistema**: SGA Ad-Hoc.
- **Comunicación**:
  - **Saliente**: API REST para envío de órdenes de recogida/entrega.
  - **Entrante**: Webhooks para confirmación de entrada física y enlaces a fotos de inventario.

## 5. Comunicaciones y Emails

- **SMTP**: Google Workspace (@boxroomer.com).
- **Diseño**: HTML/CSS responsivo alineado con la identidad visual corporativa (Manrope + BrandPurple).
- **Transactional**: Notificaciones de pedido, avisos T-7 de renovación, facturas y códigos de recogida.

## 6. Generación de Documentos (PDF)

- **Librería**: `jsPDF` (v2.5.1).
- **Funcionalidad**: Generación en cliente de Facturas, Albaranes y Contratos Legales.
- **Seguridad**: Inclusión de hashes de firma en el pie de página del PDF para trazabilidad.

## 7. Arquitectura de Interfaces (Frontend)

- **Layout System**: Basado en **Flexbox avanzado**. El uso de `display: flex` y `flex-direction: column` es mandatorio en los contenedores de los pasos (`.step-content`) para permitir el scroll interno de componentes pesados (formularios, calendarios, inventarios) sin perder de vista los controles de navegación.
- **Animaciones**: CSS Transitions para micro-interacciones y animaciones de entrada.

## 8. Inteligencia de Soporte (ChatbotBoxBot)

- **Motor**: Motor de reglas locales + Integración futura con OpenAI/Anthropic (vía API).
- **Interfaz**: Widget flotante `chat.js` personalizado con soporte para WhatsApp Direct y transiciones automáticas a humano.
- **Logs**: Almacenamiento de sesiones en `localStorage` para persistencia durante la navegación.

- **Legal**: Firma digital táctil con captura de IP, User-Agent y Timestamp.

## 9. Sistema de Navegación Dinámica

- **Lógica**: Implementada en `main.js` mediante la función `initNavPill()`.
- **Funcionamiento**: Calcula coordenadas de elementos activos dinámicamente, permitiendo que el indicador visual "vuele" entre secciones sin recargas bruscas.
- **Responsividad**: Ajusta el cálculo automáticamente para orientaciones verticales (Sidebar) u horizontales (Barra móvil).
