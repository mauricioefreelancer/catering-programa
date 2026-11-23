# Visitas y reposición por espiral

`ID_Grupo` se conserva en pedidos, ventas y recaudos y pasa a referenciar `VISITAS.ID_Visita`. La migración preserva los grupos históricos y coloca la secuencia por encima del último. Las filas históricas con grupo nulo se conservan sin atribuirles una visita ficticia. El cliente histórico se toma de `VENTAS_POR_VISITA` cuando existe.

La migración se ejecuta en una transacción. Antes de introducir las restricciones, valida que no existan negativos, recaudos duplicados, grupos con máquina u operador contradictorios ni ventas o recaudos con grupos huérfanos. Si encuentra inconsistencias, no las corrige ni borra automáticamente.

Estados de pedido:

- `PENDIENTE` y `PARCIAL`: permiten despacho y se incluyen en el informe mientras quede saldo.
- `APROBADO`: no queda nada por despachar.
- `NO_REPONER`: cierre explícito, con movimiento de cero unidades y observación.
- `REEMPLAZADO`: conserva el faltante congelado como histórico. El nuevo pedido referencia al anterior y conserva el inicio del faltante del mismo producto si sigue pendiente. Si había varios pedidos históricos abiertos, referencia el más reciente y conserva la fecha más antigua aplicable.
- `RECHAZADO`: estado cerrado legado.

El nuevo sugerido por espiral se calcula como capacidad menos físico. No se suma ni resta el faltante histórico. El movimiento de bodega y el saldo se actualizan en la misma transacción. Si falta un mapa vigente en un pedido legado, no es posible despachar unidades sobre ese pedido hasta revisar el mapa o cerrarlo expresamente.

Para desplegar, primero coordinar la adopción de `0_baseline` según [la guía del baseline](BASELINE.md). Después, en Render, el paso de predespliegue aplica esta migración antes de iniciar el nuevo backend. Publicar las pantallas de Netlify junto con el backend compatible.
