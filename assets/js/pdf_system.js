/**
 * BOXROOMER PDF System
 * Generación de Facturas y Contratos PDF en cliente
 */

const COMPANY_DATA = {
    name: "Ceiba Business, S.L.",
    taxId: "B86285897",
    address: "Calle Artes Gráficas 7",
    city: "28320 Pinto, Madrid",
    email: "soporte@boxroomer.com"
};

const PDFSystem = {
    init() {
        console.log("PDF System Initialized");
    },

    // --- UTILS ---
    getPDFDoc() {
        if (!window.jspdf) {
            alert("Error del sistema: Componente de impresión no cargado. Por favor, recarga la página.");
            return null;
        }
        // Robust instantiation for UMD build
        const { jsPDF } = window.jspdf;
        return new jsPDF();
    },

    // --- UTILS ---
    getNextInvoiceNumber() {
        const now = new Date();
        const yearShort = now.getFullYear().toString().slice(-2); // "26"

        let storedYear = localStorage.getItem('BOXROOMER_INVOICE_YEAR');
        let counter = parseInt(localStorage.getItem('BOXROOMER_INVOICE_COUNTER') || '101');

        if (storedYear !== yearShort) {
            // New year, reset counter
            counter = 101;
            localStorage.setItem('BOXROOMER_INVOICE_YEAR', yearShort);
        }

        // Return current, assume increment happens on 'save' logic or simulated per download
        return `${yearShort}/${counter}`;
    },

    incrementInvoiceCounter() {
        let counter = parseInt(localStorage.getItem('BOXROOMER_INVOICE_COUNTER') || '101');
        localStorage.setItem('BOXROOMER_INVOICE_COUNTER', counter + 1);
    },

    // --- CONTRACT UTILS ---
    getNextContractNumber() {
        const now = new Date();
        const yearShort = now.getFullYear().toString().slice(-2); // "26"
        let counter = parseInt(localStorage.getItem('BOXROOMER_CONTRACT_COUNTER') || '101');
        return `CON-${yearShort}/${counter}`;
    },

    incrementContractCounter() {
        let counter = parseInt(localStorage.getItem('BOXROOMER_CONTRACT_COUNTER') || '101');
        localStorage.setItem('BOXROOMER_CONTRACT_COUNTER', counter + 1);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
    },

    formatDate(dateObj) {
        return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    // --- INVOICE GENERATOR (PREMIUM DESIGN) ---
    async generateInvoice(invoiceData) {
        const doc = this.getPDFDoc();
        if (!doc) return;

        // Brand Colors
        const brandPurple = [79, 70, 229]; // #4F46E5
        const brandDark = [15, 23, 42];    // #0F172A
        const textGray = [100, 116, 139];  // #64748B
        const lightGray = [241, 245, 249]; // #F1F5F9

        // 1. Header Block (Full Width Background)
        doc.setFillColor(...brandPurple);
        doc.rect(0, 0, 210, 40, 'F'); // Top bar

        // Logo Text (White)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(255, 255, 255);
        doc.text("BOXROOMER", 20, 26);

        // Tagline
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(224, 231, 255); // Lighter purple
        doc.text("Tu trastero inteligente a domicilio", 20, 34);

        // Invoice Number & Date Badge (White box on right)
        const invoiceNum = invoiceData.number || this.getNextInvoiceNumber();
        const dateStr = this.formatDate(new Date());

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(140, 10, 50, 22, 2, 2, 'F');

        doc.setFontSize(8);
        doc.setTextColor(...textGray);
        doc.text("FACTURA Nº", 145, 16);
        doc.text("FECHA", 145, 26);

        doc.setFontSize(10);
        doc.setTextColor(...brandDark);
        doc.setFont("helvetica", "bold");
        doc.text(invoiceNum, 185, 16, { align: "right" });
        doc.text(dateStr, 185, 26, { align: "right" });

        // 2. Sender & Receiver (Clean Grid)
        let yPos = 60;

        // Sender Info
        doc.setFontSize(8);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "bold");
        doc.text("EMISOR (BOXROOMER)", 20, yPos);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...brandDark);
        doc.setFontSize(10);
        yPos += 6;
        doc.text(COMPANY_DATA.name, 20, yPos);
        doc.text(`NIF: ${COMPANY_DATA.taxId}`, 20, yPos + 5);
        doc.text(COMPANY_DATA.address, 20, yPos + 10);
        doc.text(COMPANY_DATA.city, 20, yPos + 15);

        // Client Info
        yPos = 60; // Reset Y
        doc.setFontSize(8);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "bold");
        doc.text("CLIENTE", 120, yPos);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...brandDark);
        doc.setFontSize(10);
        yPos += 6;
        doc.text(invoiceData.clientName || "Cliente Registrado", 120, yPos);
        doc.text(invoiceData.clientNif || "50892233K", 120, yPos + 5);
        doc.text(invoiceData.clientAddress || "Madrid, España", 120, yPos + 10);

        // 3. Items Table
        yPos = 100;

        // Table Header
        doc.setFillColor(...brandDark);
        doc.rect(20, yPos, 170, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("CONCEPTO", 25, yPos + 7);
        doc.text("BASE", 130, yPos + 7, { align: "right" });
        doc.text("IVA 21%", 160, yPos + 7, { align: "right" });
        doc.text("TOTAL", 185, yPos + 7, { align: "right" });

        // Item Row
        yPos += 18;
        doc.setTextColor(...brandDark);
        doc.setFont("helvetica", "normal");

        const concept = invoiceData.concept || "Servicio de Almacenamiento";
        const total = invoiceData.amount || 0;
        const base = total / 1.21;
        const iva = total - base;

        doc.text(concept, 25, yPos);
        doc.text(this.formatCurrency(base), 130, yPos, { align: "right" });
        doc.text(this.formatCurrency(iva), 160, yPos, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.text(this.formatCurrency(total), 185, yPos, { align: "right" });

        // Bottom Line
        doc.setDrawColor(...lightGray);
        doc.line(20, yPos + 5, 190, yPos + 5);

        // 4. Totals Block
        yPos += 20;
        const xTotals = 120;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textGray);
        doc.text("Base Imponible", 140, yPos, { align: "right" });
        doc.setTextColor(...brandDark);
        doc.text(this.formatCurrency(base), 185, yPos, { align: "right" });

        yPos += 7;
        doc.setTextColor(...textGray);
        doc.text("IVA (21%)", 140, yPos, { align: "right" });
        doc.setTextColor(...brandDark);
        doc.text(this.formatCurrency(iva), 185, yPos, { align: "right" });

        yPos += 12;
        // Total Highlight Box
        doc.setFillColor(...lightGray);
        doc.roundedRect(120, yPos - 8, 70, 14, 2, 2, 'F');
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...brandPurple);
        doc.text("TOTAL A PAGAR", 125, yPos + 2);
        doc.text(this.formatCurrency(total), 185, yPos + 2, { align: "right" });

        // 5. Footer
        doc.setFontSize(8);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("Documento generado automáticamente por BOXROOMER.", 105, 275, { align: "center" });
        doc.text("Registro Mercantil de Madrid - www.boxroomer.com", 105, 280, { align: "center" });

        const filename = `Factura_${invoiceNum.replace('/', '-')}.pdf`;
        this.savePDF(doc, filename);

        if (!invoiceData.number) this.incrementInvoiceCounter();
    },

    // --- CONTRACT GENERATOR (FULL LEGAL) ---
    generateContract(contractData) {
        const doc = this.getPDFDoc();
        if (!doc) return;

        const brandPurple = [79, 70, 229];
        const brandDark = [15, 23, 42];

        // Sequential Contract Number
        const contractNum = contractData.id || this.getNextContractNumber();

        // Header
        doc.setFontSize(16);
        doc.setTextColor(...brandPurple);
        doc.setFont("helvetica", "bold");
        doc.text("CONTRATO DE DEPÓSITO Y LOGÍSTICA", 20, 25);

        doc.setFontSize(10);
        doc.setTextColor(...brandDark);
        doc.setFont("helvetica", "bold");
        doc.text(`REF: ${contractNum}`, 190, 25, { align: "right" });

        doc.setDrawColor(200, 200, 200);
        doc.line(20, 32, 190, 32);

        // Content
        const date = this.formatDate(new Date());
        let yPos = 45;

        // 1. Identification
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`En Pinto (Madrid), a ${date}.`, 20, yPos);
        yPos += 6;
        doc.text(`BOXROOMER (${COMPANY_DATA.name}, NIF ${COMPANY_DATA.taxId}) y el CLIENTE (${contractData.clientName || "Usuario Registrado"}) acuerdan las siguientes:`, 20, yPos);

        yPos += 10;
        doc.setFont("helvetica", "bold");
        doc.text("CLÁUSULAS", 20, yPos);
        yPos += 8;

        // 2. Clauses
        const clauses = [
            { t: "1. OBJETO", c: "Boxroomer presta servicios de recogida, transporte, almacenamiento y devolución de bienes personales. El Cliente conserva la propiedad, cediendo temporalmente la custodia a Boxroomer." },
            { t: "2. PRECIO Y PAGO", c: "El pago es mensual y por anticipado. En caso de impago superior a 30 días, Boxroomer se reserva el DERECHO DE RETENCIÓN sobre los bienes depositados hasta la liquidación total de la deuda, más gastos de gestión." },
            { t: "3. DURACIÓN", c: `El servicio se contrata por un periodo inicial de ${contractData.months || "12"} meses. Se renovará tácitamente salvo aviso en contrario con 15 días de antelación.` },
            { t: "4. PROHIBICIONES DE ALMACENAJE", c: "Queda ESTRICTAMENTE PROHIBIDO almacenar: bienes ilegales, robados, armas, explosivos, materiales inflamables/peligrosos, perecederos, animales vivos o muertos, y dinero en efectivo o joyas de alto valor no declarado." },
            { t: "5. SEGURO Y RESPONSABILIDAD", c: "Se incluye un seguro con cobertura hasta 1.000€/m³. Boxroomer no se hace responsable de daños derivados de un embalaje deficiente realizado por el Cliente antes de la recogida." },
            { t: "6. PROTECCIÓN DE DATOS (RGPD)", c: "Sus datos serán tratados por Ceiba Business S.L. para la ejecución del contrato. Puede ejercer sus derechos de acceso, rectificación y supresión enviando un email a soporte@boxroomer.com." },
            { t: "7. JURISDICCIÓN", c: "Para cualquier discrepancia, las partes renuncian a su fuero propio y se someten a los Juzgados y Tribunales de Madrid capital." }
        ];

        doc.setFontSize(8);
        clauses.forEach(clause => {
            doc.setFont("helvetica", "bold");
            doc.text(clause.t, 20, yPos);
            yPos += 4;
            doc.setFont("helvetica", "normal");
            // Standardize line width and wrapping
            const lines = doc.splitTextToSize(clause.c, 170);
            doc.text(lines, 20, yPos);
            yPos += (lines.length * 4) + 5; // Compact spacing
        });

        // Signatures
        yPos = 240; // Fixed bottom position
        doc.setDrawColor(220, 220, 220);
        doc.line(20, yPos - 10, 190, yPos - 10); // Separator line

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);

        // Boxroomer Signature
        doc.text("POR BOXROOMER", 30, yPos);
        doc.rect(30, yPos + 5, 60, 20); // Border box
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229); // Purple signature
        doc.text("Ceiba Business S.L.", 35, yPos + 15);
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        doc.text("Firmado Digitalmente", 35, yPos + 22);

        // Client Signature
        doc.setFontSize(8);
        doc.text("POR EL CLIENTE", 120, yPos);
        doc.rect(120, yPos + 5, 60, 20); // Border box
        doc.setTextColor(...brandDark);
        doc.setFont("helvetica", "bold");
        doc.text("Aceptado y Firmado Online", 125, yPos + 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.text(`ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 125, yPos + 22);

        const filename = `Contrato_${contractNum.replace('/', '-')}.pdf`;
        this.savePDF(doc, filename);

        // Increment counter if it was a generated number
        if (!contractData.id) {
            this.incrementContractCounter();
        }
    },
    // --- HELPER: NEW TAB STRATEGY ---
    savePDF(doc, filename) {
        console.log("Strategy: Open New Tab | Filename:", filename);

        try {
            // This forces the browser to open the PDF in its native viewer in a new tab
            const opened = doc.output('dataurlnewwindow', { filename: filename });

            // If popup blocker stopped it, try native save as fallback
            if (!opened) {
                console.warn("Popup blocked? Trying fallback save...");
                doc.save(filename);
            }
        } catch (e) {
            console.error("PDF Display Error:", e);
            alert("No se pudo abrir el PDF. Si tienes un bloqueador de ventanas emergentes, por favor permítenos abrir el documento.");
        }
    }
};

window.PDFSystem = PDFSystem;
