# Roadmap de Tareas: Ejecución BOXROOMER

Listado de tareas críticas para la construcción y puesta en marcha del nuevo ecosistema.

## Fase 1: Entorno y Bases (Semana 1)

- [ ] **Configuración Clerk**: Crear instancia de producción y configurar Social Logins (Google).
- [ ] **Configuración Stripe**: Crear productos (Packs) y cupones en el Dashboard de Stripe.
- [ ] **Despliegue SiteGround**: Configurar subdominios y certificados SSL.
- [ ] **API SGA**: Realizar pruebas de conexión (Handshake) con el endpoint del almacén.

## Fase 2: Frontend y Wizard (Semana 2-3)

- [ ] **Wizard V1**: Maquetación de los 4 pasos del contrato (Split view con ChatBot).
- [ ] **Integración Stripe Elements**: Formulario de pago seguro en el Wizard.
- [ ] **Capa de Auth**: Proteger el acceso al Dashboard y al Admin.
- [ ] **Maquetación Emails**: Diseñar las plantillas premium de notificación.

## Fase 3: Paneles de Control (Semana 4-5)

- [ ] **Dashboard Cliente**: Vista de inventario con fotos dinámicas del SGA.
- [ ] **Torre de Control (Admin)**:
  - [ ] Tabla de clientes con buscador.
  - [ ] Timeline de actividad individual.
  - [ ] Terminal de cargos manuales y mozos extra.
- [ ] **Driver WebApp**: Interfaz móvil para conductores con firma y control de tiempos.

## Fase 4: Pruebas y Lanzamiento (Semana 6)

- [ ] **Test de Estrés**: Simular recogida -> Entrada SGA -> Facturación automática.
- [ ] **Validación Legal**: Revisión final de las condiciones con los cambios de 39€ y zonas.
- [ ] **Gofree**: Apuntar botones de la web actual al nuevo Wizard.

## Bonus / Futuro

- [ ] **App Nativa**: Conversión de la WebApp de cliente en PWA instalable.
- [ ] **Motor de Referidos**: Implementar lógica de cupones automáticos por recomendación.
