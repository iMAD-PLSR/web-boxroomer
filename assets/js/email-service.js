/**
 * BOXROOMER Email Service
 * Sistema de preparación de notificaciones premium.
 */

const EmailService = {
    // Colores de marca para los emails
    colors: {
        purple: '#6E44FF',
        dark: '#0A0A0A',
        gray: '#64748B',
        light: '#F8FAFC'
    },

    /**
     * Prepara el HTML de la plantilla
     */
    getTemplate(type, data) {
        const baseStyles = `
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #f4f4f5;
            padding: 40px 20px;
            color: #18181b;
        `;

        const cardStyles = `
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        `;

        const headerStyles = `
            background: #0A0A0A;
            padding: 40px;
            text-align: center;
        `;

        const contentStyles = `
            padding: 40px;
        `;

        const buttonStyles = `
            display: inline-block;
            background: #6E44FF;
            color: #ffffff;
            padding: 16px 32px;
            border-radius: 16px;
            text-decoration: none;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 12px;
            margin-top: 20px;
        `;

        // Logo HTML alternativo (texto con estilo si no hay imagen remota fiable)
        const logoHTML = `<h1 style="color:white; margin:0; font-style:italic; font-weight:900; letter-spacing:-1px;">BOXROOMER</h1>`;

        let specificContent = '';
        let subject = '';

        switch (type) {
            case 'manual_charge':
                subject = `Nuevo Cargo Registrado: ${data.concept}`;
                specificContent = `
                    <h2 style="font-size: 24px; font-weight: 900; font-style: italic; letter-spacing: -1px; margin-bottom: 8px;">NUEVO CARGO REGISTRADO</h2>
                    <p style="color: #71717a; font-size: 14px; line-height: 1.6;">Hola ${data.clientName}, se ha registrado un nuevo servicio en tu cuenta.</p>
                    
                    <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
                        <table width="100%">
                            <tr>
                                <td style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Concepto</td>
                                <td align="right" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Importe</td>
                            </tr>
                            <tr>
                                <td style="font-size: 14px; font-weight: 700; padding-top: 4px;">${data.concept}</td>
                                <td align="right" style="font-size: 18px; font-weight: 900; color: #6E44FF; padding-top: 4px;">${data.amount}€</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="color: #71717a; font-size: 13px;">Ya puedes descargar tu factura desde el área de cliente.</p>
                `;
                break;

            case 'new_reservation':
                subject = `Reserva Confirmada - BoxRoomer`;
                specificContent = `
                    <h2 style="font-size: 24px; font-weight: 900; font-style: italic; letter-spacing: -1px; margin-bottom: 8px;">¡BIENVENIDO A BOXROOMER!</h2>
                    <p style="color: #71717a; font-size: 14px; line-height: 1.6;">Hola ${data.clientName}, tu reserva de almacenamiento ha sido completada con éxito.</p>
                    
                    <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
                        <table width="100%">
                            <tr>
                                <td style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Servicio</td>
                                <td align="right" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Volumen</td>
                            </tr>
                            <tr>
                                <td style="font-size: 14px; font-weight: 700; padding-top: 4px;">Plan ${data.planType}</td>
                                <td align="right" style="font-size: 18px; font-weight: 900; color: #6E44FF; padding-top: 4px;">${data.volume}m³</td>
                            </tr>
                        </table>
                    </div>
                `;
                break;

            case 'monthly_payment':
                subject = `Pago de Mensualidad Confirmado`;
                specificContent = `
                    <h2 style="font-size: 24px; font-weight: 900; font-style: italic; letter-spacing: -1px; margin-bottom: 8px;">MENSUALIDAD RECIBIDA</h2>
                    <p style="color: #71717a; font-size: 14px; line-height: 1.6;">Hemos procesado correctamente el pago de tu cuota mensual de almacenamiento.</p>
                    
                    <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
                        <table width="100%">
                            <tr>
                                <td style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Cuota Mensual</td>
                                <td align="right" style="font-size: 18px; font-weight: 900; color: #6E44FF;">${data.amount}€</td>
                            </tr>
                        </table>
                    </div>
                `;
                break;
        }

        return {
            subject: subject,
            html: `
            <html>
                <body style="${baseStyles}">
                    <div style="${cardStyles}">
                        <div style="${headerStyles}">
                            ${logoHTML}
                        </div>
                        <div style="${contentStyles}">
                            ${specificContent}
                            
                            <center>
                                <a href="https://boxroomer.netlify.app/pages/cliente_pagos.html" style="${buttonStyles}">DESCARGAR FACTURA</a>
                            </center>
                            
                            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 40px 0;">
                            
                            <center>
                                <p style="color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                    Ceiba Business, S.L. - Pinto, Madrid<br>
                                    Documento generado por BoxBot IA
                                </p>
                            </center>
                        </div>
                    </div>
                </body>
            </html>
            `
        };
    },

    /**
     * Envío oficial (Llamada a Edge Function)
     */
    async send(type, to, data) {
        console.log(`📧 [EmailService] Preparando envío "${type}" para: ${to}`);

        const template = this.getTemplate(type, data);

        // --- SIMULACIÓN DE ENVÍO (MOCK) ---
        // En una implementación real, aquí llamaríamos a una Supabase Edge Function
        // o a un broker de emails como Resend.

        try {
            console.log("📤 [Email Payload]:", {
                to: to,
                subject: template.subject,
                // html: template.html // Demasiado largo para loguear siempre
            });

            // Simulamos delay de red
            await new Promise(resolve => setTimeout(resolve, 800));

            // Si window.showBoxBotToast existe (en el admin), lo usamos
            if (window.showBoxBotToast) {
                window.showBoxBotToast(`📧 Notificación enviada a ${to}`);
            } else if (typeof alert !== 'undefined') {
                // console.log(`Notificación enviada a ${to}`);
            }

            return { success: true };
        } catch (err) {
            console.error("❌ Error en EmailService:", err);
            return { success: false, error: err };
        }
    }
};

window.EmailService = EmailService;
