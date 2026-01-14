# 📦 Definición de Zonas Logísticas - BOXROOMER (Revisión 2026)

Este documento define la clasificación operativa de los códigos postales para la aplicación de tarifas de transporte gratuitas o con recargo.

## 📐 Regla General de Zonificación

La **ZONA 0 (Transporte Gratuito)** se define por un criterio geográfico doble. Un municipio pertenece a Zona 0 si cumple **al menos una** de estas dos condiciones:

1. Estar ubicado en un radio máximo de **20 km desde el Km 0** (Puerta del Sol, Madrid).
2. Estar ubicado en un radio máximo de **20 km desde las Instalaciones Centrales** (Pinto).

Todo lo que pertenezca a la Comunidad de Madrid (CP 28XXX) y **NO** cumpla estas condiciones, será considerado **ZONA 1**.

---

## � ZONA 0: Transporte Incluido (Gratis)

Incluye Madrid Capital y el "Cinturón Metropolitano" + Área de Influencia Sur (Pinto).

### Listado de Municipios y CPs

*(Lista no exhaustiva, basada en los principales núcleos de población).*

#### 1. Madrid Capital

* **CPs**: `28001` al `28087` (Toda la capital).

#### 2. Corredor Sur (Influencia Pinto + Madrid)

* **Pinto**: `28320` (Sede Central).
* **Valdemoro**: `28340` - `28343`.
* **Getafe**: `28901` - `28909`.
* **Leganés**: `28910` - `28919`.
* **Fuenlabrada**: `28940` - `28947`.
* **Parla**: `28980` - `28984`.
* **San Martín de la Vega**: `28330`.
* **Ciempozuelos**: `28350`.
* **Torrejón de Velasco / La Calzada**: `28990`, `28991`.

#### 3. Corredor Oeste / Suroeste

* **Alcorcón**: `28920` - `28925`.
* **Móstoles**: `28930` - `28939`.
* **Pozuelo de Alarcón**: `28223`, `28224`.
* **Majadahonda**: `28220` - `28222`.
* **Boadilla del Monte**: `28660`.
* **Las Rozas**: `28230` - `28232`.

#### 4. Corredor Henares / Noreste (Cercanía a Madrid)

* **Coslada**: `28820` - `28823`.
* **San Fernando de Henares**: `28830`, `28831`.
* **Rivas-Vaciamadrid**: `28521` - `28524`.

#### 5. Corredor Norte

* **Alcobendas**: `28100`, `28108`, `28109`.
* **San Sebastián de los Reyes**: `28700` - `28709`.

---

## 🟡 ZONA 1: Tarifa Kilometraje (Ida y Vuelta)

Municipios de la Comunidad de Madrid fuera del radio de 20km (de Madrid o Pinto).

### Principales Municipios Afectados (Ejemplos)

* **Zona Norte Lejana**: Tres Cantos (`28760`), Colmenar Viejo (`28770`).
* **Zona Noroeste Lejana**: Torrelodones (`28250`), Galapagar (`28260`), Collado Villalba (`28400`), El Escorial.
* **Zona Este Alejada**: Torrejón de Ardoz (`28850`), Alcalá de Henares (`28801`).
* **Zona Sureste**: Arganda del Rey (`28500`).
* **Zona Sur Lejana**: Aranjuez (`28300`).

---

## 🔴 FUERA DE ZONA (Consulta)

Cualquier CP que no comience por `28`.

---

## ⚙️ Implementación en Código

El sistema validará el CP contra una lista blanca ("Allowlist") de los CPs de Zona 0.
* Si CP está en lista Zona 0 -> **Gratis**.
* Si CP empieza por `28` y NO está en lista -> **Zona 1 (Aviso de coste)**.
* Resto -> **Fuera de Zona**.
