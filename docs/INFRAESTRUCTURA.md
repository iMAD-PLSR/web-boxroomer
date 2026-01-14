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

## 4. Integración Logística (SGA)

- **Sistema**: SGA Ad-Hoc.
- **Comunicación**:
  - **Saliente**: API REST para envío de órdenes de recogida/entrega.
  - **Entrante**: Webhooks para confirmación de entrada física y enlaces a fotos de inventario.

## 5. Comunicaciones y Emails

- **SMTP**: Google Workspace (@boxroomer.com).
- **Diseño**: HTML/CSS responsivo alineado con la identidad visual corporativa (Manrope + BrandPurple).
- **Transactional**: Notificaciones de pedido, avisos T-7 de renovación, facturas y códigos de recogida.

## 6. Seguridad y Backup

- **Backup**: SiteGround Daily Backups + Backup redundante de fotos de inventario en bucket S3/Cloud alternativo (Mirroring).
- **Legal**: Firma digital táctil con captura de IP, User-Agent y Timestamp.
