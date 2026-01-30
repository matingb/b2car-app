## Log Level

Se utiliza una variable de entorno LOG_LEVEL que podra tener alguna de los siguientes valores

`'debug' | 'info' | 'warn' | 'error' | 'none'`

Y tendra como valor por defecto none, donde no se logeara nada
Para utlizar los logeos se deberan usar las funciones homonimas a cada nivel de log pertenecientes al modulo logger
Ej: logger.debug("Soy un mensaje de debug, nivel alto de logeo")

## Database Migration

`supabase db dump --data-only > seed.sql`

Crea los inserts de toda la data de la base de datos

Las migraciones son archivos .sql que estan en la carpeta supabase/migrations.
Al ejecutar el comando

`supabase db reset`

El CLI crea desde cero la DB LOCAL y ejecuta en orden cronologico cada una de las migraciones, modificando asi el esquema de la DB.

Al finalizar, ejecuta si encuentra el archivo seed.sql con el fin de poblar toda la DB de datos.

Las migraciones pueden pushearse directamente a produccion con el comando

`supabase db push`

Esto ejecuta las migraciones que no hayan sido aplicadas aun a produccion