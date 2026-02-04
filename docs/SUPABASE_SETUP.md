# Guía de Configuración: Supabase Real 🚀

Para dejar de usar la simulación y empezar a guardar datos reales en tu base de datos, sigue estos pasos:

## 1. Crear el Proyecto en Supabase

1. Ve a [Supabase.com](https://supabase.com) y crea un nuevo proyecto llamado `BOXROOMER`.
2. Anota tu **Project URL** y tu **Anon Key** (están en *Project Settings -> API*).

## 2. Configurar las Tablas (SQL)

Copia el contenido del archivo `docs/supabase_schema.sql` y pégalo en el **SQL Editor** de Supabase. Haz clic en **Run**.
Esto creará:

- Tabla `profiles`: Para usuarios y roles.
- Tabla `leads_wizard`: Para las reservas.
- Tabla `audit_logs`: Para el registro de acciones.
- **Trigger**: Crea automáticamente un perfil cuando alguien se registra.

## 3. Conectar la Web

Abre el archivo `assets/js/supabase-config.js` y sustituye los valores:

```javascript
const SUPABASE_CONFIG = {
    URL: 'https://tu-proyecto.supabase.co',
    ANON_KEY: 'tu-anon-key-real'
};
```

## 4. Habilitar Google Auth (Opcional)

Si quieres activar el acceso con Google:

1. Ve a *Authentication -> Providers -> Google*.
2. Sigue las instrucciones de Supabase para conectar con Google Cloud Console.

---

**Nota**: Una vez configurado, el sistema detectará automáticamente las claves y cambiará del "Modo Demo" al "Modo Producción".
