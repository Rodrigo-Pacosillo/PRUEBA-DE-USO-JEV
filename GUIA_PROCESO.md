# GUÍA DEL PROCESO — Proyecto con Next.js

Documento general y descriptivo del flujo de un proyecto típico de Next.js.
No contiene comandos ni código específicos: los pasos exactos cambian según la
versión, el motor de base de datos elegido y la configuración de instalación.
Lo que se busca capturar aquí es la **lógica y el orden** del proceso.

---

## 1. Visión general

Un proyecto "fullstack" con Next.js une, en un mismo código:

- **El frontend**: las páginas que ve el usuario.
- **El backend**: las rutas que atienden datos y la conexión con la base de datos.

Conceptos de fondo que ordenan todo lo demás:

- **App Router**: sistema de enrutado actual de Next. Las rutas se derivan de la
  estructura de carpetas: dentro de la carpeta de rutas, un archivo de página
  representa la vista de esa ruta; cada carpeta es un segmento de la URL.
- **Server vs Client Components**: los componentes son *Server Components* por
  defecto (se ejecutan en el servidor, sin interactividad). Solo cuando un
  componente necesita eventos, estado o efectos (interactividad en el
  navegador) se marca explícitamente como cliente.
- **Layout compartido**: un layout raíz envuelve a todas las páginas; todo lo
  que se coloque ahí (navegación, estilos) se repite en cada ruta.

---

## 2. Instalación

El instalador de Next guía una serie de **decisiones** (no solo una descarga):

- **Lenguaje**: elegir TypeScript o JavaScript. La elección marca la experiencia
  de desarrollo para todo lo que sigue (tipado, autocompletado, errores en
  tiempo de compilación).
- **Framework de estilos**: la instalación puede incluir una solución de estilos
  lista para usar. Es una decisión cosmética, no estructural: se puede cambiar
  después.
- **Estructura de carpetas**: decidir si el código vive en una carpeta `src` o
  directamente en la raíz del proyecto. Ambas son válidas; la elección se toma
  aquí y es incómoda de cambiar después.
- **Linter y configuración base**: se instalan herramientas de calidad de código
  y archivos de configuración predeterminados.

Resultado de la instalación: un proyecto que arranca con un servidor de
desarrollo, una página de bienvenida y las configuraciones base ya resueltas
(lenguaje, estilos, enrutado). Antes de tocar nada conviene arrancar el servidor
de desarrollo una vez para confirmar que todo quedó operativo.

---

## 3. Base de datos

El orden mental de la parte de datos:

1. **Elegir el motor de base de datos** primero. Es la decisión que define el
   resto: un motor embebido local (sin servidor externo) simplifica el arranque;
   un motor de servidor aporta un flujo más cercano a producción pero exige una
   infraestructura corriendo. No hay respuesta universal: depende del objetivo.
2. **Instalar el conector de datos** (ORM) y **sus drivers**. Regla importante:
   la herramienta de línea de comandos y el cliente que se usa desde el código
   deben coincidir en versión; si se desalinean, los errores aparecen en pasos
   posteriores y confunden.
3. **Configurar el ambiente**: dónde se guarda la cadena de conexión (archivo de
   variables de entorno, típicamente ignorado por el control de versiones).
   Según la versión del conector, la carga de este archivo requiere un paso
   explícito.
4. **Definir los modelos** (las tablas): cada modelo describe una entidad y sus
   campos. Los campos con identificadores y fechas suelen autogenerarse con
   valores por defecto.
5. **Aplicar una migración**: el mecanismo que convierte los modelos en tablas
   reales dentro de la base, dejando un historial de cambios versionable. El
   nombre de la migración se pasa a la herramienta mediante su flag específico;
   un flag mal escrito aborta el proceso sin crear nada.
6. **Generar el cliente tipado**: la capa con la que el código del proyecto
   lee y escribe en la base. En algunas versiones este es un paso explícito
   aparte de la migración; si se omite, el código no encuentra las funciones de
   consulta.

Verificación de esta etapa: la base existe, la tabla creada aparece en el esquema
y las herramientas de inspección permiten ver los datos (aunque alguna
herramienta de visualización puede rechazar ciertos protocolos de conexión
locales de un motor embebido; eso no afecta al funcionamiento del ORM).

---

## 4. Desarrollo

Con la base lista, lo que sigue es la construcción de la aplicación en sí:

1. **Layout y navegación**: un componente de navegación (o "navbar") montado en
   el layout raíz queda visible en todas las páginas. Los enlaces internos usan
   el componente de enlace de Next, que navega sin recargar la página. Esta es
   la primera pieza "visible" del proyecto.
2. **Páginas**: cada ruta es una vista que se puede estilar y componer con
   bloques de datos. El encadenado de carpetas define la URL.
3. **Componentes**: piezas reutilizables. Las listas de elementos repetidos se
   generan recorriendo los datos con el método de map, y cada elemento necesita
   una llave única para que el renderizado eficiente funcione.
4. **El ciclo fullstack (escribir)**: un formulario en una página toma datos del
   usuario; el envío termina en una acción del servidor que valida los datos y
   los inserta en la base a través del cliente de datos tipado. Aquí se conectan
   los tres niveles: vista → servidor → base de datos.
5. **El ciclo fullstack (leer)**: una página consulta la base con el cliente de
   datos y pinta los registros en pantalla. Para que una página lea datos
   recién insertados, la ruta correspondiente se marca para revalidarse al
   momento del insert.
6. **El ciclo de clasificación automática**: una sugerencia guardada puede
   pasar por un modelo de decisión externo que no escribe texto sino que elige
   entre valores que el propio proyecto ya definió. La idea central es que la
   clasificación no reemplaza la decisión: el modelo aporta una distribución de
   probabilidades y es la aplicación la que decide qué hacer con ella según un
   umbral propio. El orden importa, y es el inverso al intuitivo: primero se
   escribe en la base, después se consulta al modelo, y recién entonces se
   redirige. Así, si el modelo falla, se pierde la clasificación pero nunca el
   dato que la persona envió. La fila queda marcada como pendiente de revisión
   para que una persona la retome.
7. **Qué pregunta al modelo y qué no**: conviene separar dos cosas que se
   confunden. Una es *qué es* el texto (una queja, una propuesta, un comentario
   o nada aprovechable) y otra es *cuánto vale* leerlo. Juntarlas en un solo
   número obliga a elegir entre las dos preguntas, así que se preguntan por
   separado. En cambio, hay comparaciones que no son lenguaje sino aritmética
   (por ejemplo, si la categoría detectada es la misma que la que alguien ticked
   en un desplegable): esas van en el código, sin gastar una consulta. Por el
   mismo motivo, el valor elegido por la persona **no** se le envía al modelo
   como parte de la entrada: se le sugeriría la respuesta.
8. **Reglas duras antes del modelo**: hay descartes que se pueden decidir de
   forma exacta y gratis — el texto no tiene suficientes letras distintas como
   para decir algo. Resolver eso en el código evita gastar una consulta por fila
   descartable. El límite de este tipo de regla es importante: solo alcanza para
   el ruido mecánico, y juzgar lo que significa le corresponde al modelo.
9. **Política en el código, no en el prompt**: los umbrales viven en el
   proyecto, no en la definición de las preguntas. Así se pueden recalibrar
   reejecutando la decisión sobre la distribución ya guardada, sin volver a
   llamar al modelo, y la respuesta cruda queda guardada como evidencia de por
   qué se tomó la decisión.
10. **Ruido oculto y revisión explícita**: las filas que el modelo descartó
    siguen en la base (nunca se borra lo que envió una persona) pero se ocultan
    de la lista, con un interruptor para verlas. La lista se ordena poniendo
    primero lo que necesita una persona, después lo más valioso. Esto convierte
    el modelo en un filtro que ordena el trabajo, no en un juez que descarta.
11. **Recuperar lo que quedó sin clasificar**: si el modelo no estuvo
    disponible, o si se agregaron preguntas después, quedan filas sin analizar.
    Un botón que las procesa por lotes es la salida: debe llevar un tope por lote
    (una acción de servidor tiene tiempo máximo de ejecución) y concurrencia
    limitada (para no exceder el límite de peticiones del proveedor).

---

## 5. Verificación

Comprobar capa por capa evita errores encadenados:

- **Servidor de desarrollo**: confirmar que el proyecto arranca y que cada
  página se ve y navega.
- **Base de datos**: revisar el modelo creado, aplicar una migración y poder
  ver (y en lo posible editar) los registros. Si la herramienta visual del
  conector no soporta la conexión local del motor elegido, hay vías
  alternativas (cliente de línea de comandos de la base o la propia
  aplicación leyendo los datos).
- **Formularios y persistencia**: enviar algunos registros de prueba y
  confirmar que aparecen en la vista de lectura.
- **Código**: correr el linter y, si el lenguaje lo permite, la verificación de
  tipos, antes de dar un paso por bueno.

Errores típicos (vividos en el camino):

- Banderas (flags) mal escritas en herramientas de línea de comandos: abortan
  sin hacer nada y el mensaje no siempre es claro.
- Versiones desalineadas entre el CLI de la base de datos y su cliente.
- Archivos generados que requieren un comando extra para producirse (el cliente
  tipado no aparece automáticamente después de migrar).
- Archivos de configuración escritos por el instalador (y re-escritos por el
  servidor de desarrollo) que no deben editarse a mano.

---

## 6. Construcción final

El cierre del ciclo de un proyecto:

- **Verificación de calidad**: el linter y la revisión de tipos analizan todo
  el código del proyecto.
- **Compilación de producción**: el proyecto se compila de forma optimizada
  (código mínimo enviado al navegador, páginas y layouts resueltos en
  servidor). Hay una diferencia real entre el servidor de desarrollo y la
  compilación de producción; conviene probar la de producción antes de decir
  que está listo.
- **Despliegue**: el sitio compilado se publica en un proveedor de hosting.
  Las guardas de seguridad y datos de ambiente (variables de entorno, base de
  datos) pasan de configuración de desarrollo a configuración de despliegue.

Con eso el flujo queda completo: instalar, conectar datos, desarrollar,
verificar y publicar.