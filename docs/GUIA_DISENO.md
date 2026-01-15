# 🎨 Guía de Diseño y Estética - BOXROOMER (2026)

Este documento actúa como la **Fuente de Verdad** para el diseño visual, la interfaz de usuario (UI) y la experiencia de usuario (UX) de todo el ecosistema BOXROOMER. Cualquier nueva página, componente o funcionalidad debe basarse en estos principios para mantener la coherencia y el sentimiento "Premium".

---

## 🌈 1. Identidad Visual (Colores)

La paleta se divide en colores de marca estáticos y colores dinámicos para el asistente inteligente.

### Colores Principales (Brand)

- **Brand Purple**: `#642d91` (Corporativo base) / `#6E44FF` (Púrpura vibrante para el Asistente/Wizard).
- **Brand Dark**: `#1A1A1A` (Textos principales, negro profundo).
- **Brand Gray**: `#F7F4F9` (Fondos suaves, superficies secundarias).
- **Brand Accent**: `#212529` (Elementos de contraste).

### Colores de Estado

- **Éxito**: Esmeralda/Verde (`#10B981`) para validaciones y ahorros.
- **Aviso**: Ámbar/Naranja para advertencias.
- **Error**: Rojo suave para campos obligatorios faltantes.

---

## ✍️ 2. Tipografía

Se utilizan fuentes de Google Fonts con jerarquías claras:

- **Títulos Principales (H1, H2)**: `Outfit` o `Manrope` (Font-weight: 800+, Italic opcional). Uso de `uppercase` y `tracking-tighter`.
- **Cuerpo y Mensajes Bot**: `Inter` o `Outfit` (Font-weight: 400-600).
- **Etiquetas y Micro-textos**: `uppercase`, `font-black`, `tracking-[0.1em]`.

---

## 🍱 3. Componentes y UI Patterns

### Card Desgin (Magnetic Cards)

- **Bordes**: Radios ultra-redondeados (`2rem` a `3rem`).
- **Sombras**: Sombras profundas y suaves (`shadow-2xl`) con tintes púrpura (`rgba(110, 68, 255, 0.1)`).
- **Interacción**: Efecto "Magnetic" al hover: `transform: translateY(-8px) scale(1.02)`.

### Controles Dinámicos

- **Sliding Pills (Regla de Oro)**: Cualquier selección entre dos o más opciones (toggles, pestañas, selectores de modalidad) **DEBE** usar el efecto de píldora deslizante. No se permiten botones estáticos simples para selecciones excluyentes.
- **Custom Range Sliders**: Sliders personalizados con "thumb" púrpura y sombra de resplandor.
- **Glassmorphism**: Uso de `backdrop-blur-md` y fondos con opacidad (`bg-white/80`) para headers y overlays.

---

## 🤖 4. BoxBot & Chat Experience

El chat no es una ventana secundaria, es el **copiloto** de la experiencia.

- **Estética del Mensaje**: Burbujas con degradados suaves, bordes muy redondeados y un sutil resplandor (`glow`).
- **Visual Feedback**: Uso de "Typing Indicators" (puntos animados) para simular pensamiento.
- **AI Scan Overlay**: Efecto de escaneado visual (línea de luz que baja) al transicionar entre pasos importantes.
- **Tono de Voz**: Cercano, experto, proactivo y siempre enfocado en la tranquilidad del cliente (uso de emojis y negritas estratégicas).

---

## 📏 5. Reglas de Contenido y Legibilidad

- **Sin Placeholders**: Siempre usar datos reales o ejemplos de alta calidad.
- **Jerarquía de Lectura**: Los totales y confirmaciones siempre deben ser los elementos más grandes de la pantalla.
- **Espaciado**: Aire generoso entre secciones (`pt-4`, `mb-8`, etc.) para evitar el agobio visual.

---

## 🎨 6. Iconografía (Material Symbols)

La iconografía es un pilar de la interfaz "Limpia e Inteligente".

- **Biblioteca**: Uso exclusivo de **Google Material Symbols (Outlined)**.
- **Configuración Estándar**:
  - `wght`: 400 (Normalmente) / 700 (Para estados activos/importantes).
  - `opsz`: 48 (Garantiza nitidez en tamaños pequeños).
  - `FILL`: 0 (Mantener huecos para estilo Outlined) / 1 (Solo para indicadores de selección crítica).
- **Semántica**: Los iconos deben ser autoexplicativos (ej. `box` para paquetes, `schedule` para horarios, `lock` para seguridad).
- **🚫 Prohibición de Emojis**: Queda estrictamente prohibido el uso de emojis dentro de botones, etiquetas o cabeceras de la interfaz principal. Toda representación visual simbólica debe realizarse mediante la librería oficial de iconos para mantener la estética premium y profesional. Los emojis solo se permiten en el flujo de conversación del ChatBot (BoxBot).

---

## 📱 7. Experiencia Móvil (UX Mobile-First)

BOXROOMER debe sentirse como una App nativa en el móvil.

- **Layout Dinámico**:
  - En Desktop: Paneles divididos (Formulario | Chat).
  - En Móvil: El chat lateral desaparece y se convierte en **AI Smart Toasts** (avisos proactivos en la parte superior).
- **Componentes Táctiles**:
  - Área de toque mínima: `44px x 44px`.
  - Botones principales en móviles: Ancho completo (`w-full`) para facilitar el uso con el pulgar.
- **Scroll Inteligente**:
  - Uso de `overflow-x-auto` con `snap-x` para listas horizontales (ej. el calendario de selección de fecha).
  - Ocultar barras de scroll visuales (`scrollbar-hide`) pero mantener la funcionalidad.
- **Micro-interacciones**: Feedback visual inmediato al tocar (escalado sutil `-active:scale-95`).

---

## 🏗️ 8. Layout Híbrido (Responsive)

Para las áreas de gestión (`/app` y `/admin`), se sigue un patrón de diseño adaptable que maximiza la usabilidad en cada dispositivo:

### Ecosistema Móvil (Pantallas < 768px)

- **Bottom Navigation Bar**: Navegación persistente en la parte inferior con 4-5 iconos clave.
- **Floating Action Button (FAB)**: Botón central elevado para la acción principal ("Añadir", "Crear").
- **Smart Header**: Cabecera compacta que se oculta o minimiza al hacer scroll.

### Ecosistema Escritorio (Pantallas >= 768px)

- **Sidebar Navigation**: La barra inferior se transforma automáticamente en una columna lateral izquierda fija (Sidebar).
- **Expanded Grid**: El contenido de una columna se expande a parrillas de 2, 3 o 4 columnas (`grid-cols-2 md:grid-cols-4`).
- **Data Density**: Se muestra más información secundaria que en móvil se oculta por espacio.

## 🎨 9. Estética "Premium Dark" (Acceso y Gestión)

Para las páginas de Login, Registro y el Dashboard del Cliente, se implementa una estética de "Modo Oscuro Profundo" para elevar la percepción de seguridad y exclusividad.

- **Fondo**: Degradado radial o lineal desde `#0A0510` (negro púrpura) hasta `#1A1A1A`.
- **Efectos de Fondo**: "Blobs" de color sutiles (Púrpura y Azul) con alto nivel de desenfoque (`blur-[120px]`) y animaciones de pulso.
- **Glassmorphism Extremo**:
  - Fondos de tarjeta: `bg-white/[0.03]` o `bg-white/5`.
  - Desenfoque de fondo: `backdrop-blur-2xl`.
  - Bordes: `border-white/10` (muy sutil).
- **Tipografía**:
  - Títulos con `italic`, `font-black` y `tracking-tighter`.
  - Etiquetas con `brandPurple/80` y `uppercase tracking-widest`.
- **Botones de Acción**:
  - Gradientes vibrantes con sombras de resplandor (`shadow-brandPurple/20`).
  - Efectos de "shimmer" (brillo que recorre el botón) al pasar el cursor.

### Dashboard & Client Area (Dark Aesthetic)

- **Glass-Cards**: Use `bg-white/[0.02]` with `backdrop-blur-3xl` and `border-white/5`.
- **Accent Radiance**: Use `bg-gradient-to-br from-brandPurple to-purple-400` for primary actions and highlights.
- **Micro-Animations**: Use `hover:scale-105 active:scale-95` on interactive cards and buttons.
- **Status Indicators**: Vibrant glows for payment statuses (`bg-emerald-500/10 text-emerald-500` with emerald borders).

---

## 🔟 10. Modal Design System

Los modals en BOXROOMER son portales de interacción inmersiva:

- **Backdrop**: `#0A0510/95` con `backdrop-blur-xl` para aislamiento total.
- **Container**: `bg-white/[0.03]` con bordes `white/10` y radios de `3rem`.
- **Decoración**: Inclusión de "Blobs" de color internos (ej. `brandPurple/10`) en las esquinas del modal.
- **Scroll**: Siempre definido dentro del contenedor del modal con `scrollbar-hide`.
- **Acciones**: Botones de cierre destacados y botones de guardado con efectos de gradiente y brillo dinámico.

---

## 🏗️ 11. Evolución del Diseño

Este documento se actualizará cada vez que se apruebe un cambio estético significativo. Para cualquier desarrollo nuevo:

1. Consultar este MD antes de picar código.
2. Mantener los radios de borde (`rounded-3xl` / `rounded-[3rem]`).
3. **Consistencia de Fuentes**: Nunca bajar de un tamaño legible.
4. **Seguridad Stripe**: Integrar siempre los logos de Stripe con opacidad suave (`opacity-60`) y escala gris para no distraer pero dar confianza.
5. **Efectos Premium**: Siempre usar `backdrop-blur` en superficies que lo requieran para mantener la profundidad.

---

## 🔀 12. Sliding Pill System (SPS)

El **Sliding Pill System** es el estándar de oro para selectores binarios o de opciones múltiples. Proporciona un feedback visual suave y premium al usuario.

- **Estructura HTML**:
  - `toggle-container`: Contenedor con `position: relative`, `display: flex`, y bordes redondeados.
  - `sliding-pill`: Elemento absoluto que se desplaza horizontalmente.
  - `buttons`: Elementos relativos con `z-index: 10` para estar sobre la píldora.
- **Variantes de Tema**:
  - **Light Theme (Default)**: Píldora blanca sobre fondo gris suave/transparente. Ideal para interfaces de configuración general.
  - **Dark/Brand Theme (`.dark-theme`)**: Píldora de color `brandPurple` con resplandor (`shadow-brandPurple/40`) sobre fondo oscuro. Usado para selecciones críticas y botones destacados.
- **Animación**: Debe usar `cubic-bezier(0.175, 0.885, 0.32, 1.275)` para un efecto de rebote suave ("elastic motion").
- **Lógica de Control**: El desplazamiento se maneja mediante `transform: translateX()` calculado dinámicamente según el ancho del botón seleccionado.

---

## 🏗️ 13. Admin Tower Aesthetics (Torre de Control)

El panel de administración utiliza una estética de "Instrumentación Técnica" que combina la elegancia del Dark Mode con la precisión de los datos masivos.

- **Data Tables (High Density)**:
  - Filas con `hover:bg-white/[0.03]` y transiciones de color suaves.
  - Uso de fuentes monoespaciadas (`font-mono`) para identificadores (IDs, DNI, Transacciones).
  - Badges de estado con `border` y `bg-opacity-10` para una lectura jerárquica instantánea.
- **Analytics & Graphs (Chart.js)**:
  - **Líneas**: Grosor de `4px` con degradados de relleno (`fill: true`) y puntos de control `pointRadius: 6`.
  - **Grid**: Solo líneas horizontales ultra-sutiles (`rgba(255,255,255,0.03)`).
  - **Interacción**: Tooltips personalizados con cálculos de diferencia porcentual.
- **Multi-Tab Modals (Client 360)**:
  - Navegación superior interna mediante pestañas con `border-b-2` animado.
  - Organización de información en "Grids de Información" (2 columnas) con etiquetas `uppercase tracking-widest` de 9px.
  - Secciones de "Acción Rápida" con iconos grandes y fondos contrastados.

---

## 🏗️ 14. Wizard Layout & Internal Scroll

Para garantizar una experiencia fluida en el asistente de reserva, se utiliza un sistema de contenedores flex profundos:

- **Contenedor Principal (`.step-content`)**: Siempre debe usar `display: flex !important` y `flex-direction: column !important`. Esto asegura que el paso ocupe el 100% de la altura de la tarjeta sin desbordarla.
- **Cabeceras y Navs**: Se mantienen estáticos en la parte superior del flujo flex.
- **Cuerpo Scrolleable (`.flex-grow.overflow-y-auto`)**: El contenedor de contenido principal utiliza `flex-grow` para ocupar el espacio restante y `overflow-y-auto` para activar el scroll interno si el contenido (calendario, formularios, extras) excede el área visible.
- **Scrollbar Premium**: Se aplica la clase `.custom-scrollbar` para mantener la estética corporativa incluso en las barras de desplazamiento.

---

## 🏗️ 15. Dynamic Navigation Indicators (Fluid Pills)

Para el área de cliente, se implementa un sistema de navegación con indicadores fluidos ("Sliding Pills") que se desplazan físicamente hacia el item activo, creando una sensación de continuidad y fluidez de alta gama.

- **Estructura**:
  - Contenedor con clase `.nav-relative` y el id correspondiente (`sidebar-nav-pill` o `bottom-nav-pill`).
  - Un elemento hijo vacío con clase `.nav-indicator-sidebar` o `.nav-indicator-mobile`.
  - Los items de navegación deben tener la clase `.nav-item-pill-active` cuando están seleccionados.
- **Lógica de Movimiento**:
  - El desplazamiento se calcula en tiempo real mediante JavaScript (`main.js`) midiendo el `offsetTop`/`offsetLeft` y `offsetHeight`/`offsetWidth` del item con la clase activa.
  - La transición utiliza un easing elástico `cubic-bezier(0.175, 0.885, 0.32, 1.275)` para un efecto premium.
- **Animaciones de Entrada**:
  - Todo el contenido principal (`<main>`) debe utilizar la clase `.fade-in-section` para una entrada suave y coordinada con la navegación.
