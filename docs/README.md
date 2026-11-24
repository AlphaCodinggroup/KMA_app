# Documentación — KMA Mobile

| Documento                             | Contenido                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [ARQUITECTURA.md](./ARQUITECTURA.md)  | Capas, puertos y adaptadores, almacenamiento local, bootstrap, sesión/HTTP, sincronización y decisiones de diseño     |
| [UML.md](./UML.md)                    | Componentes, clases de dominio, puertos y adaptadores, modelo de datos SQLite, clases de sincronización, navegación   |
| [DTE.md](./DTE.md)                    | Diagramas de transición de estados: submission, outbox, envío, corrida del flow, foto, SyncService, sesión, catálogos |
| [CASOS-DE-USO.md](./CASOS-DE-USO.md)  | Actores, diagrama de casos de uso y descripción de cada caso (con su comportamiento sin red)                          |
| [secuencias/](./secuencias/README.md) | Diagramas de secuencia de los flujos funcionales online y offline                                                     |

Los diagramas están en [Mermaid](https://mermaid.js.org/). Estos documentos describen el código tal como está hoy;
al cambiar un flujo, hay que actualizar el diagrama correspondiente.
