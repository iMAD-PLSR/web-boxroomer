/*
 * BoxBot - Custom WhatsApp Chat Assistant for BOXROOMER
 */

window.BoxBot = {
    googleSheetUrl: 'https://script.google.com/macros/s/AKfycbxQD7de7JX3Bpmm0Bz72Iees3I8CsV1aWuOfX3KVQBkORCI2OB1FdJOd95JU3dXH42gPg/exec',
    state: {
        isOpen: false,
        step: 'welcome',
        isResuming: false,
        isTyping: false,
        data: {
            volume: null,
            volumeLabel: '',
            duration: null,
            zip: '',
            zone: 'A',
            estimatedPrice: 0,
            inventory: {} // Store { 'itemName': quantity }
        }
    },

    // Zona 0 prefixes
    zone0Prefixes: ['280', '281', '282', '283', '288', '289'],

    messageQueue: [],
    isProcessingQueue: false,

    // Audio for notification
    audioContext: null,
    playNotificationSound() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.1);

            gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.1);
        } catch (e) {
            console.log("Audio not supported or blocked");
        }
    },

    init() {
        if (document.getElementById('boxbot-widget')) return;
        this.injectHTML();
        this.bindEvents();
        this.loadSession();

        if (this.state.isResuming) {
            this.addBotMessage(`¡Hola de nuevo! 👋 He guardado tus datos del ${this.state.data.volumeLabel || 'presupuesto'}. ¿Quieres continuar donde lo dejamos?`, () => {
                this.showOptions([
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">play_arrow</span> Continuar`, action: () => this.resumeFlow() },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">restart_alt</span> Empezar de cero`, action: () => { this.resetSession(); this.greet(); } }
                ]);
            });
        } else {
            this.greet();
        }

        // Proactive greeting after 5s if not opened
        setTimeout(() => {
            if (!this.state.isOpen) {
                this.showWelcomeBubble();
            }
        }, 5000);
    },

    greet() {
        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) optionsArea.classList.remove('expanded');

        const isEmpresas = window.location.pathname.includes('empresas.html');
        if (isEmpresas) {
            this.addBotMessage("¡Hola! 👋 Veo que buscas soluciones para tu empresa. ¿Te ayudo con el inventario o stock?", () => {
                this.showOptions([
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">inventory_2</span> Calcular stock/archivo`, action: () => this.startFlow() },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">person</span> Hablar con un asesor`, action: () => this.talkToHuman() }
                ]);
            });
        } else {
            this.addBotMessage("¡Hola! 👋 Soy el asistente de BOXROOMER. ¿En qué puedo ayudarte hoy?", () => {
                this.showOptions([
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">package_2</span> Calcular presupuesto`, action: () => this.startFlow() },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">lightbulb</span> Guía y consejos`, action: () => this.startTips() },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">help</span> Preguntas frecuentes`, action: () => this.startFAQs() },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">person</span> Hablar con un humano`, action: () => this.talkToHuman() }
                ]);
            });
        }
    },

    showWelcomeBubble() {
        const bubble = document.getElementById('boxbot-welcome-bubble');
        if (bubble) {
            bubble.classList.add('visible');
            // Auto hide after 8s if still not opened
            setTimeout(() => {
                if (!this.state.isOpen) {
                    bubble.classList.remove('visible');
                }
            }, 8000);
        }
    },

    injectHTML() {
        const widget = document.createElement('div');
        widget.id = 'boxbot-widget';
        widget.innerHTML = `
            <div id="boxbot-welcome-bubble">
                ¿Necesitas ayuda con tu presupuesto? 📏
            </div>
            <div id="boxbot-container">
                <div id="boxbot-header">
                    <div class="avatar">
                        <span class="material-symbols-outlined" style="color: white; font-size: 32px;">robot_2</span>
                    </div>
                    <div class="info">
                        <h4>BOXBOT <span class="status-dot"></span></h4>
                        <p>IA Operativa Especializada</p>
                    </div>
                    <button id="boxbot-close" style="margin-left: auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer; border-radius: 14px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
                    </button>
                </div>
                <div id="boxbot-messages"></div>
                <div id="boxbot-typing-container"></div>
                <div id="boxbot-options"></div>
                <div id="boxbot-status-bar">
                    <span class="status-pulse"></span>
                    <span>System Active</span>
                </div>
            </div>
            <div id="boxbot-launcher">
                <div class="icon-dots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
                <span class="material-symbols-outlined launcher-icon" style="color: white; font-size: 32px; display: none;">smart_toy</span>
            </div>
        `;
        document.body.appendChild(widget);
    },

    bindEvents() {
        const widget = document.getElementById('boxbot-widget');
        const launcher = document.getElementById('boxbot-launcher');
        const closeBtn = document.getElementById('boxbot-close');

        if (launcher) launcher.onclick = (e) => { e.stopPropagation(); this.toggleChat(); };
        if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); this.toggleChat(); };

        // Prevent clicks inside the widget from closing it
        if (widget) {
            widget.onclick = (e) => e.stopPropagation();
        }

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (this.state.isOpen) {
                const widget = document.getElementById('boxbot-widget');
                // If the click is not on the widget or any of its children
                // AND not on a button intended to open/interact with the chat
                if (widget && !widget.contains(e.target) && !e.target.closest('[onclick*="loadAndOpenChat"]')) {
                    this.toggleChat();
                }
            }
        });
    },

    openChat(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        this.state.isOpen = true;
        const bubble = document.getElementById('boxbot-welcome-bubble');
        if (bubble) bubble.classList.remove('visible');
        const container = document.getElementById('boxbot-container');
        const launcher = document.getElementById('boxbot-launcher');
        if (container) container.classList.add('active');
        if (launcher) {
            launcher.querySelector('.icon-dots').style.display = 'none';
            const icon = launcher.querySelector('.launcher-icon');
            icon.style.display = 'block';
            icon.innerText = 'close';
        }
        this.scrollToBottom();
    },

    toggleChat() {
        this.state.isOpen = !this.state.isOpen;
        if (this.state.isOpen) {
            const bubble = document.getElementById('boxbot-welcome-bubble');
            if (bubble) bubble.classList.remove('visible');
        }
        const container = document.getElementById('boxbot-container');
        const launcher = document.getElementById('boxbot-launcher');

        if (container) container.classList.toggle('active', this.state.isOpen);

        // Toggle launcher icon
        if (launcher) {
            const dots = launcher.querySelector('.icon-dots');
            const icon = launcher.querySelector('.launcher-icon');
            if (this.state.isOpen) {
                dots.style.display = 'none';
                icon.style.display = 'block';
                icon.innerText = 'close';
            } else {
                dots.style.display = 'flex';
                icon.style.display = 'none';
            }
        }

        const hint = document.getElementById('boxbot-hint');
        if (hint) hint.remove();

        if (this.state.isOpen) {
            this.scrollToBottom();
        }
    },

    // UI Helpers
    addBotMessage(text, callback) {
        this.messageQueue.push({ text, callback });
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    },

    processQueue() {
        if (this.messageQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const { text, callback } = this.messageQueue.shift();

        this.showTyping();

        // Humanized delay: 0.9s base + variable factor
        const randomFactor = 0.9 + Math.random() * 0.5;
        const delay = Math.min(Math.max(text.length * 12 * randomFactor, 1200), 3000);

        setTimeout(() => {
            this.hideTyping();

            // Notification sound
            this.playNotificationSound();

            const msgContainer = document.getElementById('boxbot-messages');
            if (msgContainer) {
                const msg = document.createElement('div');
                msg.className = 'bot-msg';

                // Format bold text and line breaks like in reserva.js
                let formattedText = text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>');

                msg.innerHTML = formattedText;
                msgContainer.appendChild(msg);
                this.scrollToBottom();
            }

            if (callback) callback();

            // Small pause (800ms) between multiple messages in queue
            setTimeout(() => this.processQueue(), 800);
        }, delay);
    },

    addUserMessage(text) {
        const msgContainer = document.getElementById('boxbot-messages');
        if (msgContainer) {
            const msg = document.createElement('div');
            msg.className = 'user-msg';
            msg.innerText = text;
            msgContainer.appendChild(msg);
            this.scrollToBottom();
        }
    },

    showTyping() {
        const container = document.getElementById('boxbot-typing-container');
        if (container) {
            container.innerHTML = `
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;
            this.scrollToBottom();
        }
    },

    hideTyping() {
        const container = document.getElementById('boxbot-typing-container');
        if (container) container.innerHTML = '';
    },

    showOptions(options) {
        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) {
            optionsArea.innerHTML = '';

            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = `chat-btn ${opt.primary ? 'primary' : ''}`;
                btn.innerHTML = opt.text;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (opt.text.indexOf('</span>') !== -1) {
                        const cleanText = opt.text.split('</span>')[1].trim();
                        this.addUserMessage(cleanText);
                    } else {
                        this.addUserMessage(opt.text);
                    }
                    optionsArea.innerHTML = '';
                    opt.action();
                };
                optionsArea.appendChild(btn);
            });
            this.scrollToBottom();
        }
    },

    scrollToBottom() {
        const msgContainer = document.getElementById('boxbot-messages');
        if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    },

    // Flow Logic
    startFlow() {
        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) optionsArea.classList.remove('expanded');

        this.state.step = 'volume';
        this.addBotMessage("¡Perfecto! Vamos a calcularlo. ¿Qué necesitas guardar aproximadamente?", () => {
            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">inventory_2</span> Pack Mini (1 m³)`, action: () => this.setVolume(1, "Pack Mini") },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">group</span> Pack Dúo (2 m³)`, action: () => this.setVolume(2, "Pack Dúo") },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">calculate</span> Lo calculo por objetos`, action: () => this.startInventoryCalculator() },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">help</span> No estoy seguro`, action: () => this.showVolumeHelp() }
            ]);
        });
    },

    showVolumeHelp() {
        this.addBotMessage("No te preocupes, la mayoría no lo sabe a la primera. 😊 Una habitación pequeña suele ser 2-3 m³. Un piso entero de 70m² unos 10-12 m³.");
        this.addBotMessage("¿Te gustaría usar nuestra calculadora visual por objetos?", () => {
            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">calculate</span> Sí, usar calculadora`, action: () => this.startInventoryCalculator() },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">edit</span> Poner m³ manualmente`, action: () => this.askManualVolume() },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">arrow_back</span> Volver`, action: () => this.startFlow() }
            ]);
        });
    },

    askManualVolume() {
        this.addBotMessage("Dime aproximadamente cuántos m³ crees que necesitas (ej: 5):");
        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) {
            optionsArea.innerHTML = `
                <div style="display: flex; gap: 8px; width: 100%;">
                    <input type="number" id="manual-m3" placeholder="m³..." class="chat-input" style="flex: 1;" />
                    <button id="submit-manual" class="chat-btn primary" style="width: auto; padding: 0 20px;">OK</button>
                </div>
            `;
            const manualInput = document.getElementById('manual-m3');
            const manualSubmit = document.getElementById('submit-manual');

            setTimeout(() => manualInput.focus(), 100);

            manualInput.onkeypress = (e) => {
                if (e.key === 'Enter') manualSubmit.click();
            };

            manualSubmit.onclick = (e) => {
                e.stopPropagation();
                const val = parseFloat(manualInput.value);
                if (val > 0) {
                    this.setVolume(val, val + " m³");
                }
            };
            // Also stop propagation on input click
            manualInput.onclick = (e) => e.stopPropagation();
        }
    },

    // Tips & Guide Section
    startTips() {
        this.addBotMessage("¡Prepara tu mudanza como un pro! ✨ Aquí tienes consejos para ahorrar dinero y proteger tus cosas:", () => {
            const optionsArea = document.getElementById('boxbot-options');
            if (optionsArea) optionsArea.classList.add('expanded');

            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">savings</span> Cómo ahorrar dinero`, action: () => this.tipDetail('ahorro') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">package_2</span> El embalaje perfecto`, action: () => this.tipDetail('embalaje') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">shield</span> Protección de frágiles`, action: () => this.tipDetail('proteccion') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">local_shipping</span> Tips día de recogida`, action: () => this.tipDetail('dia_r') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">arrow_back</span> Volver al menú`, action: () => this.greet() }
            ]);
        });
    },

    tipDetail(type) {
        const tips = {
            preparacion: [
                "💡 <strong>Preparar es ahorrar:</strong> Si desmontas muebles o preparas bultos antes de que lleguemos, evitarás cargos extra por tiempo. ¡Nosotros podemos ayudarte si lo prefieres!",
                "💡 <strong>Peso ideal:</strong> Intenta que las cajas no superen los 20kg. Es más seguro para tus cosas y ayuda a nuestros mozos a trabajar con agilidad.",
                "💡 <strong>Precintado en 'H':</strong> Sella tus cajas con precinto formando una 'H' (tapa superior e inferior). Es la forma más resistente de evitar aperturas accidentales."
            ],
            embalaje: [
                "📦 <strong>Tú eliges el embalaje:</strong> Aceptamos cualquier bulto, pero las cajas son ideales para optimizar espacio y proteger mejor.",
                "📦 <strong>Ropa y textiles:</strong> Nuestras naves están higienizadas, pero recomendamos usar bolsas tipo zip o de cierre hermético para una protección perfecta a largo plazo."
            ],
            proteccion: [
                "🛡️ <strong>Tvs y pantallas:</strong> Si no tienes la caja original, protege la pantalla con cartón y envuélvela en burbuja. ¡Doble seguridad!",
                "🛡️ <strong>Espejos y cuadros:</strong> Protege siempre las esquinas con cartón. Llévalos siempre de canto, nunca tumbados, para evitar que el cristal sufra."
            ],
            dia_r: [
                "🚚 <strong>Todo preparado:</strong> Si tienes todo listo e incluso bajado a pie de calle, no habrá ningún cargo extra por tiempo. ¡Rápido y económico!",
                "🚚 <strong>Mozo Extra:</strong> Para objetos muy pesados es obligatorio un Mozo Extra (35€) para garantizar la seguridad. Incluye los 15' primeros de cortesía.",
                "🚚 <strong>Catálogo privado:</strong> Si identificas tus bultos por fuera, en tu catálogo online saldrán con el nombre que elijas (ej: <em>'Ropa de verano'</em>)."
            ]
        };

        const content = tips[type];
        let index = 0;

        const showNext = () => {
            if (index < content.length) {
                this.addBotMessage(content[index], () => {
                    index++;
                    setTimeout(showNext, 1200);
                });
            } else {
                setTimeout(() => this.startTips(), 2500);
            }
        };

        showNext();
    },

    startFAQs() {
        this.addBotMessage("¡Soy una enciclopedia de BOXROOMER! 🧐 Elige un tema para ver las preguntas más comunes:", () => {
            const optionsArea = document.getElementById('boxbot-options');
            if (optionsArea) optionsArea.classList.add('expanded');

            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">payments</span> Precios y pagos`, action: () => this.faqCategory('precios') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">local_shipping</span> Recogidas y logística`, action: () => this.faqCategory('logistica') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">security</span> Seguridad y confianza`, action: () => this.faqCategory('seguridad') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">inventory_2</span> Inventario y App`, action: () => this.faqCategory('app') },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">arrow_back</span> Volver al inicio`, action: () => this.greet() }
            ]);
        });
    },

    faqCategory(cat) {
        const faqs = {
            precios: [
                { q: "¿Hay permanencia?", a: "No hay permanencia, puedes recuperar tus cosas cuando quieras. El único requisito es cumplir el contrato original (3, 6 o 12 meses). Si te llevas todo antes, se liquida el periodo restante." },
                { q: "¿Tenéis ofertas por largo plazo?", a: "¡Sí! Si contratas un plan de 12 meses, aplicamos un descuento equivalente a 3 meses gratis. **Pagas 9 y disfrutas de 12**. ¡Es nuestra mejor tarifa!" },
                { q: "¿Emitís factura con IVA?", a: "Sí, de forma automática. Ideal para que empresas y autónomos puedan desgravar el gasto sin gestiones extra." },
                { q: "¿Cómo medís el volumen?", a: "Usamos volumétricos automáticos de alta precisión. Además, una segunda persona revisa siempre la medición para asegurar que sea 100% justa." },
                { q: "¿Cómo se paga?", a: "Mediante tarjeta o domiciliación bancaria. Se cobra mes a mes por adelantado desde el día de la recogida." }
            ],
            logistica: [
                { q: "¿Cuánto tardáis en entregar?", a: "Entregamos habitualmente al día siguiente. Tú eliges el día y la hora en la Web App y nosotros te confirmamos." },
                { q: "¿Puedo ir yo a recoger o dejar cosas?", a: "¡Claro! Con preaviso puedes venir a nuestro centro de Pinto. Dejar cosas es GRATIS (0€), pero recogerlas tiene un coste de gestión de 39€ (Zona 0), ya que la manipulación interna dentro del almacén genera gastos logísticos igualmente." },
                { q: "¿Puedo pedir solo una parte?", a: "¡Claro! Puedes recuperar solo lo que necesites (una caja, un mueble...). En los Packs, cualquier entrega parcial tiene un coste de 39€ (Zona 0) por activación de transporte." },
                { q: "¿Entregáis en otra dirección?", a: "Sí, puedes añadir una dirección de entrega diferente en el asistente de recuperación de tu catálogo online." },
                { q: "¿Podéis tirar muebles viejos?", a: "Ofrecemos servicio de punto limpio o destrucción. Se valorará según el volumen y requiere autorización firmada." },
                { q: "¿Qué pasa si no estoy en casa?", a: "Si hay ausencia en una cita acordada, se facturará un suplemento de 39€ por servicio fallido (+ kilometraje ida/vuelta si es fuera de zona). ¡Asegúrate de estar disponible!" }
            ],
            seguridad: [
                { q: "¿Dónde está vuestro centro?", a: "Nuestras instalaciones principales de más de 10.000m² están en Pinto (Madrid). Cuentan con vigilancia 24/7, sistemas avanzados contra incendios y control de temperatura/humedad constante." },
                { q: "¿Están seguras mis cosas?", a: "¡Más que en casa! El acceso al almacén está restringido solo a personal autorizado, lo que garantiza privacidad total y cero riesgos de terceros." },
                { q: "¿Hay un contrato legal?", a: "Sí, firmas un contrato digital de depósito y custodia que garantiza la máxima protección legal para tus bienes desde el minuto uno." },
                { q: "¿Qué está prohibido guardar?", a: "Por seguridad, no aceptamos alimentos, líquidos inflamables, dinero, seres vivos o artículos que contengan baterías." },
                { q: "¿Puedo visitar el almacén?", a: "Por motivos de seguridad y eficiencia logística, no hay libre acceso a las zonas de almacenaje. No obstante, puedes venir a dejar bultos o recogerlos con cita previa en nuestra zona habilitada de atención." }
            ],
            app: [
                { q: "¿Tengo que descargar algo?", a: "No hace falta. Nuestra App es una Web App alojada en la nube; puedes acceder desde cualquier navegador en tu móvil u ordenador." },
                { q: "¿Cómo veo mis cosas?", a: "En tu catálogo online privado verás fotos de cada bulto. Si les pusiste nombre al recogerlos, aparecerán con esa misma identificación." },
                { q: "¿Puedo compartir mi acceso?", a: "¡Sí! Puedes dar tus claves a un familiar o socio para que también pueda gestionar el inventario o pedir entregas de vuelta." },
                { q: "¿Puedo añadir cosas luego?", a: "¡Claro! Solo tienes que pedir una 'Nueva recogida' desde la Web App y pasaremos a por más cosas para tu trastero." }
            ]
        };

        const currentList = faqs[cat];
        this.addBotMessage(`Aquí tienes las dudas sobre este tema:`, () => {
            const optionsArea = document.getElementById('boxbot-options');
            if (optionsArea) optionsArea.classList.add('expanded');

            const options = currentList.map(item => ({
                text: item.q,
                action: () => {
                    this.addBotMessage(item.a);
                    setTimeout(() => this.faqCategory(cat), 2000); // 2s so they can read comfortably
                }
            }));
            options.push({ text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">arrow_back</span> Volver a categorías`, action: () => this.startFAQs() });

            this.showOptions(options);
        });
    },

    // Inventory Calculator
    startInventoryCalculator() {
        this.addBotMessage("Selecciona los objetos que quieres guardar y yo calcularé los metros cúbicos por ti:", () => {
            this.renderInventory();
        });
    },

    renderInventory() {
        const items = [
            { name: "Caja mediana", m3: 0.05, icon: "package" },
            { name: "Caja grande", m3: 0.1, icon: "package_2" },
            { name: "Maleta / Bolso", m3: 0.1, icon: "luggage" },
            { name: "Patinete eléctrico", m3: 0.1, icon: "electric_scooter" },
            { name: "Bicicleta", m3: 0.6, icon: "directions_bike" },
            { name: "Silla", m3: 0.2, icon: "chair" },
            { name: "Sillón / Butaca", m3: 0.7, icon: "armchair" },
            { name: "Escritorio", m3: 0.6, icon: "desk" },
            { name: "Cómoda", m3: 0.5, icon: "dresser" },
            { name: "Mesilla de noche", m3: 0.15, icon: "bedroom_parent" },
            { name: "Mesa (desmontada)", m3: 0.3, icon: "table_restaurant" },
            { name: "Colchón individual", m3: 0.4, icon: "bed" },
            { name: "Colchón matrimonio", m3: 0.8, icon: "bed" },
            { name: "Cama individual (desm.)", m3: 0.5, icon: "bed" },
            { name: "Cama matrimonio (desm.)", m3: 1.0, icon: "bed" },
            { name: "Sofá 2 plazas", m3: 1.2, icon: "weekend" },
            { name: "Sofá 3 plazas", m3: 1.6, icon: "weekend" },
            { name: "Chaise longue", m3: 2.8, icon: "weekend" },
            { name: "Armario / Estantería", m3: 1.0, icon: "shelves" },
            { name: "Electrodoméstico", m3: 0.5, icon: "kitchen" }
        ];

        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) {
            optionsArea.classList.add('expanded');
            optionsArea.innerHTML = `
                <div class="inventory-live-tracker">
                    <span>m³ estimados:</span>
                    <span id="live-m3-val">0 m³</span>
                </div>
                <div id="inventory-list" style="display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; padding: 5px;">
                    ${items.map(item => `
                        <div style="display: flex; align-items: center; justify-between; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 12px; gap: 10px;">
                            <span class="material-symbols-outlined" style="color: var(--brandPurple); font-size: 20px;">${item.icon}</span>
                            <div style="flex: 1;">
                                <p style="margin:0; font-size: 12px; font-weight: 700; color: white;">${item.name}</p>
                                <p style="margin:0; font-size: 9px; color: #94a3b8;">${item.m3} m³</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button onclick="BoxBot.updateInventory('${item.name}', -1, ${item.m3})" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                                <span id="qty-${item.name}" style="font-size: 13px; font-weight: 800; min-width: 15px; text-align: center; color: white;">0</span>
                                <button onclick="BoxBot.updateInventory('${item.name}', 1, ${item.m3})" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--brandPurple); background: var(--brandPurple); color: white; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                     <button id="cancel-inventory" class="chat-btn" style="flex: 1; padding: 14px; background: rgba(255,255,255,0.05);">Cancelar</button>
                     <button id="finish-inventory" class="chat-btn primary" style="flex: 2; padding: 14px;">Confirmar <span class="material-symbols-outlined" style="font-size: 18px; margin-left: 8px; vertical-align: middle;">check</span></button>
                </div>
            `;

            document.getElementById('cancel-inventory').onclick = () => {
                this.addBotMessage("Cancelado. ¿Qué te gustaría hacer ahora?");
                this.startFlow();
            };
            document.getElementById('finish-inventory').onclick = () => this.finishInventory();
        }
    },

    updateInventory(name, change, m3) {
        if (!this.state.data.inventory) this.state.data.inventory = {};
        const current = this.state.data.inventory[name] || 0;
        const next = Math.max(0, current + change);
        this.state.data.inventory[name] = next;

        const qtyEl = document.getElementById(`qty-${name}`);
        if (qtyEl) qtyEl.innerText = next;

        // Update live counter
        let total = 0;
        const list = document.getElementById('inventory-list');
        if (list) {
            const divs = list.querySelectorAll(':scope > div');
            divs.forEach(div => {
                const qty = parseInt(div.querySelector('span[id^="qty-"]').innerText);
                const m3Text = div.querySelector('p:last-child').innerText;
                const singleM3 = parseFloat(m3Text);
                total += qty * singleM3;
            });
        }

        // Round up to nearest 0.5 as business rule
        const roundedTotal = Math.ceil(total * 2) / 2;
        const liveVal = document.getElementById('live-m3-val');
        if (liveVal) liveVal.innerText = `${roundedTotal} m³`;
        this.state.data.volume = roundedTotal;
    },

    finishInventory() {
        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) optionsArea.classList.remove('expanded');

        const vol = this.state.data.volume || 0.5;
        const objects = Object.entries(this.state.data.inventory || {})
            .filter(([_, qty]) => qty > 0)
            .map(([name, qty]) => `${qty} ${name}`)
            .join(', ');

        const label = objects ? `Inventario (${objects})` : `Calculado (${vol} m³)`;
        this.setVolume(vol, label);
    },

    showTrustTip(context, callback) {
        const tips = {
            volume: [
                "💡 ¿Sabías que? Nuestro operario verificará el volumen real el día de la recogida para que solo pagues lo justo.",
                "✅ Tranquilidad total: si al final ocupas menos de lo calculado, te reajustamos el precio y te devolvemos la diferencia en el acto.",
                "🔍 No te preocupes por la precisión exacta ahora; si añades algún objeto extra el día de la recogida, lo gestionamos allí mismo."
            ],
            duration: [
                "🎁 El 80% de nuestros clientes eligen el pack de 6 meses para llevarse un mes gratis.",
                "📅 Puedes ampliar tu tiempo de almacenaje cuando quieras desde la App."
            ],
            zip: [
                "🚚 En Madrid ciudad tenemos flota propia circulando hoy mismo.",
                "✨ Nuestra Zona 0 incluye los desplazamientos más frecuentes con tarifa plana."
            ]
        };

        const contextTips = tips[context] || [];
        // 40% chance of showing a trust tip
        if (contextTips.length > 0 && Math.random() < 0.4) {
            const randomTip = contextTips[Math.floor(Math.random() * contextTips.length)];
            this.addBotMessage(`<div class="trust-tip">${randomTip}</div>`);
            setTimeout(() => {
                if (callback) callback();
            }, 1000);
        } else {
            if (callback) callback();
        }
    },

    setVolume(vol, label) {
        this.state.data.volume = vol;
        this.state.data.volumeLabel = label;
        this.state.step = 'duration';

        this.showTrustTip('volume', () => {
            this.addBotMessage(`Entendido. ¿Y por cuánto tiempo lo necesitas guardar?`, () => {
                this.showOptions([
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">calendar_month</span> 3 meses`, action: () => this.setDuration(3) },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">verified</span> 6 meses (1 gratis 🎁)`, action: () => this.setDuration(6) },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">rocket_launch</span> 12 meses (3 gratis 🎁)`, action: () => this.setDuration(12) },
                    { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">arrow_back</span> Volver`, action: () => this.startFlow() }
                ]);
            });
        });
    },

    setDuration(months) {
        this.state.data.duration = months;
        this.state.step = 'zip';

        this.showTrustTip('duration', () => {
            this.addBotMessage(`Perfecto. Por último, dime tu Código Postal para confirmar la zona de recogida:`);
            const optionsArea = document.getElementById('boxbot-options');
            if (optionsArea) {
                optionsArea.innerHTML = `
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <input type="text" id="zip-input" maxlength="5" placeholder="CP (ej: 28001)..." class="chat-input" style="flex: 1;" />
                        <button id="submit-zip" class="chat-btn primary" style="width: auto; padding: 0 20px;">Calcular</button>
                    </div>
                `;
                const zipInput = document.getElementById('zip-input');
                const zipSubmit = document.getElementById('submit-zip');

                setTimeout(() => zipInput.focus(), 100);

                zipInput.onkeypress = (e) => {
                    if (e.key === 'Enter') zipSubmit.click();
                };

                zipSubmit.onclick = () => {
                    const val = zipInput.value;
                    if (val.length === 5) {
                        optionsArea.innerHTML = ''; // Hide input immediately
                        this.setZip(val);
                    }
                };
            }
        });
    },

    setZip(zip) {
        this.state.data.zip = zip;
        this.addUserMessage(zip);

        // Logical zone check
        const prefix = zip.substring(0, 3);
        const isZone0 = this.zone0Prefixes.includes(prefix) || zip.toLowerCase().includes('madrid');
        this.state.data.zone = isZone0 ? '0' : 'KM';
        this.state.data.zoneLabel = isZone0 ? 'Zona 0' : 'Zona 1';

        const msg = isZone0
            ? "📍 ¡Buenas noticias! Tu CP está dentro de nuestra Zona 0 (Tarifa fija de entrega)."
            : "📍 Veo que estás un poco más lejos (Zona 1). No te preocupes, damos servicio en toda la provincia con tarifa por km ida y vuelta a Pinto.";

        this.addBotMessage(msg, () => {
            this.showTrustTip('zip', () => {
                this.calculateAndSummary();
            });
        });
    },

    calculateAndSummary() {
        const { volume, duration, zone, volumeLabel } = this.state.data;
        let price = 0;

        // Replicate logic from calculator.js with new fixed prices
        if (volume <= 1) {
            // Pack Mini Fixed
            if (duration === 3) price = 139;
            else if (duration === 6) price = 199; // Fixed
            else if (duration === 12) price = 319; // Fixed
            else price = 139; // fallback
        } else if (volume <= 2) {
            // Pack Duo Fixed
            if (duration === 3) price = 199;
            else if (duration === 6) price = 309; // Fixed
            else if (duration === 12) price = 529; // Fixed
            else price = 199; // fallback
        } else {
            let base = 39 + (volume - 1) * 16;
            // 6 months (1 free) | 12 months (3 free)
            price = duration === 6 ? base * 5 : (duration === 12 ? base * 9 : base * duration);
        }

        const monthlyPrice = Math.round(price / duration);

        this.addBotMessage(`¡Tengo tu presupuesto estimado! 🚀`, () => {
            let summaryMsg = `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); margin: 4px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                        <div>
                             <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">TU PLAN</p>
                             <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: white; display: flex; align-items: center; gap: 6px;">
                                <span class="material-symbols-outlined" style="font-size: 14px; color: var(--brandPurple);">package_2</span> ${volume}m³ 
                                <span style="color: rgba(255,255,255,0.2);">|</span> 
                                <span class="material-symbols-outlined" style="font-size: 14px; color: var(--brandPurple);">calendar_month</span> ${duration} meses
                             </p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 20px; font-weight: 900; color: var(--brandPurple); line-height: 1; letter-spacing: -0.03em;">${monthlyPrice}€<span style="font-size: 11px;">/mes</span></p>
                            <p style="margin: 2px 0 0 0; font-size: 9px; color: #94a3b8; font-weight: 600;">Total: ${price}€ (IVA inc.)</p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.9);">
                        <span style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 14px; color: var(--brandPurple);">local_shipping</span> Recogida GRATIS</span>
                        <span style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 14px; color: var(--brandPurple);">shield</span> Seguro INCLUIDO</span>
                        <span style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 14px; color: var(--brandPurple);">timer</span> 15' cortesía</span>
                        <span style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 14px; color: var(--brandPurple);">package_2</span> Entrega: ${volume <= 2 ? 'Incluida' : (zone === '0' ? '39€' : 'Pendiente')}</span>
                    </div>
                </div>
            `;

            this.addBotMessage(summaryMsg, () => {
                this.askLeadCapture(price);
            });
        });
    },

    askLeadCapture(price) {
        this.addBotMessage("¿Quieres que te envíe este presupuesto por <strong>Email</strong> o <strong>WhatsApp</strong> para tenerlo a mano y no perderlo? 📩", () => {
            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">mail</span> Sí, guardar mis datos`, action: () => this.askLeadInfo(price), primary: true },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">skip_next</span> No, solo continuar`, action: () => this.showFinalOptions(price) },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">arrow_back</span> Volver atrás`, action: () => this.setDuration(this.state.data.duration) } // Go back to asking for ZIP
            ]);
        });
    },

    askLeadInfo(price) {
        this.addBotMessage("¡Genial! Solo necesito tu nombre y un contacto (email o móvil) para enviártelo ahora mismo:");
        const optionsArea = document.getElementById('boxbot-options');
        if (optionsArea) {
            optionsArea.classList.add('expanded');
            const isPageInSubdir = window.location.pathname.includes('/pages/');
            const privPath = isPageInSubdir ? 'privacidad.html' : 'pages/privacidad.html';

            optionsArea.innerHTML = `
                <div id="lead-form-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                    <input type="text" id="boxbot-lead-name" placeholder="Tu nombre..." class="chat-input" />
                    <input type="text" id="boxbot-lead-contact" placeholder="Email o Móvil..." class="chat-input" />
                    
                    <div style="display: flex; gap: 8px; align-items: flex-start; padding: 4px; margin-top: 4px;">
                        <input type="checkbox" id="boxbot-lead-check" style="margin-top: 4px; border: 2px solid var(--brandPurple);" />
                        <label for="boxbot-lead-check" style="font-size: 10px; color: rgba(255,255,255,0.6); line-height: 1.3;">
                            Acepto la <a href="${privPath}" target="_blank" style="color: var(--brandPurple); font-weight: 700; text-decoration: underline;">política de privacidad</a> para recibir mi presupuesto.
                        </label>
                    </div>

                    <button id="boxbot-lead-submit" class="chat-btn primary" style="padding: 12px; margin-top: 4px;">Enviar y ver reserva 🚀</button>
                </div>
            `;

            const nameInput = document.getElementById('boxbot-lead-name');
            const contactInput = document.getElementById('boxbot-lead-contact');
            const submitBtn = document.getElementById('boxbot-lead-submit');

            setTimeout(() => nameInput.focus(), 100);

            const handleEnter = (e) => {
                if (e.key === 'Enter') submitBtn.click();
            };
            nameInput.onkeypress = handleEnter;
            contactInput.onkeypress = handleEnter;

            submitBtn.onclick = (e) => {
                e.stopPropagation();
                const name = nameInput.value;
                const contact = contactInput.value;
                const accepted = document.getElementById('boxbot-lead-check').checked;

                if (name.length < 2 || contact.length < 5) {
                    alert("Por favor, introduce un nombre y contacto válidos.");
                    return;
                }

                if (!accepted) {
                    alert("Debes aceptar la política de privacidad para continuar.");
                    return;
                }

                this.state.data.leadName = name;
                this.state.data.leadContact = contact;
                this.saveSession();

                // Send to Google Sheets
                this.sendLeadToGoogleSheet(price);

                this.addUserMessage(`Me llamo ${name} y mi contacto es ${contact}`);
                this.addBotMessage(`¡Recibido ${name.split(' ')[0]}! Ya lo tengo anotado. Ahora sí, ¿cómo prefieres completar tu reserva?`, () => {
                    this.showFinalOptions(price);
                });
            };

            // Stop propagation on clicks within the form inputs
            document.getElementById('boxbot-lead-name').onclick = (e) => e.stopPropagation();
            document.getElementById('boxbot-lead-contact').onclick = (e) => e.stopPropagation();
            document.getElementById('boxbot-lead-check').onclick = (e) => e.stopPropagation();
        }
    },

    sendLeadToGoogleSheet(price) {
        const { volume, duration, zone, leadName, leadContact } = this.state.data;

        const payload = {
            name: leadName,
            contact: leadContact,
            volume: volume,
            duration: duration,
            zone: zone,
            price: price
        };

        fetch(this.googleSheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Error sending lead:", err));
    },

    showFinalOptions(price) {
        this.showOptions([
            { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">bolt</span> Reserva directa (App)`, action: () => this.goToApp(), primary: true },
            { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">chat</span> Hablar por WhatsApp`, action: () => this.finishToWhatsApp('reservation', price) },
            { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">question_answer</span> Tengo otras dudas`, action: () => this.finishToWhatsApp('doubts', price) },
            { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">refresh</span> Volver a empezar`, action: () => this.startFlow() },
            { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">home</span> Volver al inicio`, action: () => this.greet() }
        ]);
    },

    goToApp() {
        this.addBotMessage("¡Excelente elección! ⚡ Te llevo directamente a nuestro asistente de reservas para que confirmes los detalles sin perder tus datos.", () => {
            setTimeout(() => {
                const { volume, duration } = this.state.data;
                // Default fallback values if something is missing
                const volParam = volume || 2.0;
                const durParam = duration || 3;

                // Construct URL just like calculator.js
                // Note: handling path relative/absolute depending on where chat is loaded
                const isPageInSubdir = window.location.pathname.includes('/pages/');
                // Use clean URLs (no .html) to avoid redirects stripping query params
                const targetPath = isPageInSubdir ? 'reserva' : 'pages/reserva';

                window.location.href = `${targetPath}?vol=${volParam}&months=${durParam}`;
            }, 1000);

            // No need for post-redirect options since we are navigating away in same tab
        });
    },

    talkToHuman() {
        this.addBotMessage("¡Sin problema! Conecto con un compañero para que te atienda personalmente:", () => {
            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">chat</span> WHATSAPP DIRECTO`, action: () => this.finishToWhatsApp('doubts', 0), primary: true },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">undo</span> Volver al inicio`, action: () => this.greet() }
            ]);
        });
    },

    finishToWhatsApp(intent, estimatedPrice) {
        const { volumeLabel, duration, zip, zone, leadName } = this.state.data;
        let text = "";

        const introduction = leadName ? `Soy *${leadName}* y he usado` : `He usado`;

        if (intent === 'reservation') {
            text = `¡Hola BOXROOMER! 👋 ${introduction} el asistente web para calcular mi presupuesto y quiero RESERVAR:\n`;
        } else {
            text = `¡Hola BOXROOMER! 👋 ${introduction} el asistente web y tengo unas DUDAS sobre mi presupuesto:\n`;
        }

        text += `- Servicio: *${volumeLabel}*\n`;
        text += `- Tiempo: *${duration} meses*\n`;
        text += `- Recogida en: *${zip}* (Zona ${zone})\n`;
        text += `- Estimación total: *${estimatedPrice}€*\n\n`;

        if (intent === 'reservation') {
            text += `¿Me podéis confirmar disponibilidad para estos días?`;
        } else {
            text += `¿Podríais darme más detalles? Gracias!`;
        }

        const waUrl = `https://wa.me/34638807886?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');

        // Show options to return after redirect
        setTimeout(() => {
            this.addBotMessage("¿Te puedo ayudar con alguna otra cosa mientras te atendemos por WhatsApp?");
            this.showOptions([
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">undo</span> VOLVER AL INICIO`, action: () => this.greet() },
                { text: `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 8px;">restart_alt</span> EMPEZAR NUEVO CÁLCULO`, action: () => this.startFlow() }
            ]);
        }, 2000);
    },

    // Session Management
    saveSession() {
        localStorage.setItem('boxbot_session', JSON.stringify({
            data: this.state.data,
            step: this.state.step,
            timestamp: Date.now()
        }));
    },

    loadSession() {
        const saved = localStorage.getItem('boxbot_session');
        if (saved) {
            const session = JSON.parse(saved);
            // Expire session after 2 hours
            if (Date.now() - session.timestamp < 2 * 60 * 60 * 1000) {
                this.state.data = session.data;
                this.state.step = session.step;
                this.state.isResuming = true;
            } else {
                this.resetSession();
            }
        }
    },

    resetSession() {
        localStorage.removeItem('boxbot_session');
        this.state.isResuming = false;
        this.state.step = 'welcome';
        this.state.data = {
            volume: null,
            volumeLabel: '',
            duration: null,
            zip: '',
            zone: 'A',
            estimatedPrice: 0,
            inventory: {}
        };
    },

    resumeFlow() {
        if (this.state.step === 'duration') {
            this.setVolume(this.state.data.volume, this.state.data.volumeLabel);
        } else if (this.state.step === 'zip') {
            this.setDuration(this.state.data.duration);
        } else {
            this.startFlow();
        }
    }
};

// Initialize BoxBot when page is ready
// Initialize BoxBot when page is ready or immediately if already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BoxBot.init());
} else {
    BoxBot.init();
}
