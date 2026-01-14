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

- **Sliding Pills**: Selectores de tipo "píldora" deslizante con transiciones `cubic-bezier`.
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

## 🛠️ 8. Evolución del Diseño

Este documento se actualizará cada vez que se apruebe un cambio estético significativo. Para cualquier desarrollo nuevo:

1. Consultar este MD antes de picar código.
2. Mantener los radios de borde (`rounded-3xl` / `rounded-[3rem]`).
3. **Consistencia de Fuentes**: Nunca bajar de un tamaño legible (ej. los textos secundarios que ajustamos al 25% extra son el nuevo estándar).
4. **Seguridad Stripe**: Integrar siempre los logos de Stripe con opacidad suave (`opacity-60`) y escala gris para no distraer pero dar confianza.
