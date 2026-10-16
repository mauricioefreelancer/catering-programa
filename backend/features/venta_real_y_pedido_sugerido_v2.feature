# language: es
#
# Especificación BDD (v2) de la corrección del cálculo de venta real y pedido sugerido,
# alineada con el código del repositorio catering-programa (commit d9af794).
# Fuente funcional: análisis "Cálculo de venta real y pedido sugerido" (15 de octubre de 2026).
# Valores monetarios en pesos, sin impuestos y sin separador de miles.
#
# Ubicación del comportamiento actual en el código:
#   backend/src/operador-pedido/operador-pedido.service.ts  create(), ajustarSugerida()
#   backend/src/despachos/despachos.service.ts              create(), pendientes()
#   backend/src/treasury/treasury.service.ts                vendidoPorVisita(), createEfectivoNr()
#   frontend/src/pages/Mobile/Inventario/index.tsx          wizard Espirales > Contadores NR/NRQ > Guardar
#   frontend/src/pages/Despachos/index.tsx                  cupoRestante y botón "No reponer"
#   backend/prisma/schema.prisma                            PedidosOperador, DespachosBodega, MapaMateriaPrima, VentasPorVisita
#
# Etiquetas:
#   @regresion             reproduce un error del código actual con datos de la secuencia de prueba
#   @existente             comportamiento que ya funciona y no se debe romper
#   @nuevo                 requiere campos, estados o pantallas que hoy no existen
#   @propuesta             regla no definida por negocio; validar antes de implementar
#   @pendiente-definicion  requiere análisis adicional
#   @movil @despachos @recaudo @mapa  módulo afectado

Característica: Venta real y pedido sugerido por espiral con un día de rezago entre el sugerido y la carga
  Como empresa de vending
  Quiero calcular la venta de cada espiral contra lo que quedó en la máquina en la visita anterior
  Para que la venta por producto cuadre con la diferencia de NR y el sugerido sea lo que realmente hay que reponer

  Cómo funciona hoy el código (commit d9af794):
    1. POST /api/pedidos-operador calcula cantSugerida = max(0, capacidadMax - fisicoDigitado) y le resta
       lo pendiente de pedidos PENDIENTE o PARCIAL de la misma máquina (ajustarSugerida, agrupado por producto).
    2. Al registrar la visita, VENTAS_POR_VISITA.totalVendidoProductos = suma de cantSugerida x precio.
    3. GET /api/tesoreria/vendido-por-visita recalcula totalVendidoProductos = suma de (cantSugerida - pendiente) x precio,
       es decir, lo despachado contra el sugerido, y lo vuelve a escribir en la base cada vez que se consulta.
    4. POST /api/despachos limita con cupoRestante = capacidadMax - (fisicoDigitado + despachado del mismo pedido),
       no limita nada si el espiral ya está lleno, y "No reponer" crea DESPACHOS_BODEGA con 0 unidades.
    5. pendienteDesp de cada despacho = cantSugerida - cantDespachada de ese despacho, no del acumulado.
    6. La app móvil no tiene paso de confirmación de carga ni contador NR producto.
    7. MAQUINAS_Y_TIENDAS.ultimoContadorNR se actualiza al registrar la visita y otra vez al registrar el recaudo.
    Resultado: la "venta por producto" depende de lo sugerido y de lo que bodega despachó, no de lo que se vendió.
    En la secuencia de prueba, la visita 2 da 273500 si bodega ya despachó la visita 1, y 148500 si no lo ha hecho.

  Modelo correcto, por visita n y espiral (idMapaMp):
    inventarioInicial(n) = inventarioFinal(n-1) guardado; en la primera visita, MAPA_MATERIA_PRIMA.capacidadActual
    ventaUnidades(n)     = inventarioInicial(n) - fisicoDigitado(n)
    ventaValor(n)        = ventaUnidades(n) x precioVigente(n-1)
    inventarioFinal(n)   = fisicoDigitado(n) - retiros(n) + cantCargada(n)
    cantSugerida(n)      = max(0, capacidadMax - inventarioFinal(n)), o 0 si estadoEspiral es NO_REPONER
    cantCargada(n) es lo que bodega despachó y el operador confirma que ingresó a la máquina, no lo sugerido.

  Cambios de datos propuestos (los campos existentes conservan su nombre):
    PEDIDOS_OPERADOR, una fila por visita (idGrupo) y espiral (idMapaMp):
      existentes: fisicoDigitado, cantSugerida, nrActualMedido, nrqActualLectura, estado
      nuevos: inventarioInicial, ventaUnidades, precioVigente, ventaValor, retiros, motivoRetiro,
              cantCargada, novedadCarga, inventarioFinal, nrProductoMedido
      estado: PENDIENTE, PARCIAL, APROBADO y el nuevo CERRADO (reemplazado por la visita siguiente)
    DESPACHOS_BODEGA, por línea:
      existentes: cantDespachada, pendienteDesp, idMapaMp, stockAntes, stockDespues
      nuevos: estadoCarga (EN_TRANSITO, CARGADO o DEVUELTO), cantCargada, cantDevuelta, idGrupoCarga
    MAPA_MATERIA_PRIMA: capacidadActual pasa a ser el inventario actual del espiral (hoy solo se edita a mano)
      nuevos: estadoEspiral (ACTIVO o NO_REPONER), motivoEstado
    VENTAS_POR_VISITA:
      existentes: nrAnterior, nrActual, totalVendido (diferencia NR), totalVendidoProductos, unidadesSugeridas, detalle
      nuevos: unidadesVendidas, nrProductoAnterior, nrProductoActual
    DespachoItemDto: se elimina el campo noReponer.
    CreatePedidoOperadorDto: se agregan nrProducto e items[].retiros, items[].motivoRetiro, items[].cantCargada, items[].novedadCarga.

  Antecedentes:
    Dado el cliente "CLIENTE-TEST" con estos precios en PRECIOS_CLIENTE:
      | producto              | precioVenta |
      | Bonyurt Alpina        | 5500        |
      | Yogurt Alpina 150 gms | 5000        |
      | Yogurt Finnesse       | 5000        |
      | Yogurt Griego 150 gr  | 5500        |
      | Coca Cola lata normal | 6000        |
      | Fuze Tea surtido      | 5000        |
      | Jugo Valle Fress      | 4500        |
    Y la máquina "MAQ-TEST" de tipo "SNACKS" asignada a "CLIENTE-TEST" y a un operador
    Y su MAPA_MATERIA_PRIMA es:
      | espiralCodigo | producto              | capacidadMax | capacidadActual | estadoEspiral |
      | A0            | Bonyurt Alpina        | 15           | 15              | ACTIVO        |
      | A1            | Yogurt Alpina 150 gms | 14           | 14              | ACTIVO        |
      | A2            | Yogurt Finnesse       | 13           | 13              | ACTIVO        |
      | A3            | Yogurt Griego 150 gr  | 12           | 12              | ACTIVO        |
      | A4            | Coca Cola lata normal | 10           | 10              | ACTIVO        |
      | B0            | Fuze Tea surtido      | 9            | 9               | ACTIVO        |
      | B2            | Jugo Valle Fress      | 8            | 8               | ACTIVO        |

  # ---------------------------------------------------------------------------
  Regla: El operador registra conteo, contadores y carga, en ese orden

    @movil @existente
    Escenario: El físico digitado no puede superar la capacidad del espiral
      Cuando el operador registra fisicoDigitado 16 en A0
      Entonces el sistema rechaza el registro con el mensaje "Físico digitado 16 excede capacidad 15"

    @movil @existente
    Escenario: El NR actual es obligatorio y no puede ser menor que el anterior
      Dado que el último NR de la máquina es 1125000
      Cuando el operador digita nrActual 1100000
      Entonces la app no permite avanzar del paso "Contadores NR/NRQ"

    @movil @nuevo
    Escenario: El NR producto también es obligatorio
      Cuando el operador intenta avanzar del paso "Contadores NR/NRQ" sin digitar nrProducto
      Entonces la app no permite avanzar y muestra el mensaje "Digita el NR producto"

    @movil @nuevo
    Escenario: La app agrega el paso de carga entre los contadores y el guardado
      Cuando el operador abre la visita de la máquina en la app móvil
      Entonces los pasos del registro son "Espirales", "Contadores NR/NRQ", "Carga" y "Guardar"
      Y el paso "Carga" solo se habilita después de completar los contadores

    @movil @nuevo
    Escenario: La carga se prellena con lo despachado en tránsito por espiral
      Dado que existen líneas de DESPACHOS_BODEGA en estadoCarga EN_TRANSITO para la máquina:
        | espiralCodigo | cantDespachada |
        | A0            | 2              |
        | A1            | 3              |
        | A2            | 3              |
        | A3            | 3              |
        | A4            | 4              |
        | B0            | 6              |
        | B2            | 3              |
      Cuando el operador llega al paso "Carga"
      Entonces cada espiral muestra prellenada su cantCargada con la cantidad en tránsito

    @movil @nuevo
    Escenario: Cargar una cantidad distinta a la despachada exige novedad
      Dado que A4 tiene 4 unidades EN_TRANSITO
      Cuando el operador cambia la cantCargada de A4 a 3 sin registrar novedadCarga
      Entonces la app no permite guardar y muestra el mensaje "Registra la novedad de la diferencia"

    @movil @propuesta
    Escenario: Un producto que no está en el mapa no se puede registrar
      Cuando el operador envía un ítem de un producto que no está en el MAPA_MATERIA_PRIMA de la máquina
      Entonces el sistema rechaza el registro con el mensaje "El producto no está en el mapa de la máquina"
      # Hoy el código asume capacidad 500 en el backend y 15 en el frontend.

  # ---------------------------------------------------------------------------
  Regla: Venta, inventario final y sugerido se calculan por espiral con un día de rezago

    @movil @regresion
    Escenario: Primera visita, la base es la carga de instalación del mapa
      Dado que la máquina no tiene visitas registradas
      Y su último NR es 1000000 y su último NR producto es 5000
      Y no hay despachos EN_TRANSITO para la máquina
      Cuando el operador registra la visita con este conteo:
        | espiralCodigo | fisicoDigitado |
        | A0            | 13             |
        | A1            | 11             |
        | A2            | 10             |
        | A3            | 9              |
        | A4            | 6              |
        | B0            | 3              |
        | B2            | 5              |
      Y digita nrActual 1125000 y nrProducto 5024
      Y confirma la carga sin producto
      Entonces se crea una visita con un idGrupo nuevo y estas líneas en PEDIDOS_OPERADOR:
        | espiralCodigo | inventarioInicial | fisicoDigitado | ventaUnidades | ventaValor | cantCargada | inventarioFinal | cantSugerida |
        | A0            | 15                | 13             | 2             | 11000      | 0           | 13              | 2            |
        | A1            | 14                | 11             | 3             | 15000      | 0           | 11              | 3            |
        | A2            | 13                | 10             | 3             | 15000      | 0           | 10              | 3            |
        | A3            | 12                | 9              | 3             | 16500      | 0           | 9               | 3            |
        | A4            | 10                | 6              | 4             | 24000      | 0           | 6               | 4            |
        | B0            | 9                 | 3              | 6             | 30000      | 0           | 3               | 6            |
        | B2            | 8                 | 5              | 3             | 13500      | 0           | 5               | 3            |
      Y todas las líneas quedan en estado PENDIENTE
      Y VENTAS_POR_VISITA de la visita queda con:
        | totalVendido          | 125000 |
        | totalVendidoProductos | 125000 |
        | unidadesVendidas      | 24     |
        | unidadesSugeridas     | 24     |
      Y el capacidadActual de cada espiral en MAPA_MATERIA_PRIMA queda igual a su inventarioFinal

    @movil @despachos @regresion
    Escenario: Visita 2 con el pedido anterior ya despachado, la venta no vuelve a contar el espacio vacío
      Dado que la visita anterior de la máquina cerró en PEDIDOS_OPERADOR con:
        | espiralCodigo | inventarioFinal | cantSugerida | estado   |
        | A0            | 13              | 2            | APROBADO |
        | A1            | 11              | 3            | APROBADO |
        | A2            | 10              | 3            | APROBADO |
        | A3            | 9               | 3            | APROBADO |
        | A4            | 6               | 4            | APROBADO |
        | B0            | 3               | 6            | APROBADO |
        | B2            | 5               | 3            | APROBADO |
      Y su nrActualMedido es 1125000 y su nrProductoMedido es 5024
      Y bodega despachó completo ese pedido, con 24 unidades en DESPACHOS_BODEGA en estadoCarga EN_TRANSITO
      Cuando el operador registra la visita con este conteo:
        | espiralCodigo | fisicoDigitado |
        | A0            | 5              |
        | A1            | 10             |
        | A2            | 5              |
        | A3            | 3              |
        | A4            | 3              |
        | B0            | 1              |
        | B2            | 2              |
      Y digita nrActual 1273500 y nrProducto 5052
      Y confirma la carga de lo despachado sin cambios
      Entonces la visita queda con estas líneas en PEDIDOS_OPERADOR:
        | espiralCodigo | inventarioInicial | fisicoDigitado | ventaUnidades | ventaValor | cantCargada | inventarioFinal | cantSugerida |
        | A0            | 13                | 5              | 8             | 44000      | 2           | 7               | 8            |
        | A1            | 11                | 10             | 1             | 5000       | 3           | 13              | 1            |
        | A2            | 10                | 5              | 5             | 25000      | 3           | 8               | 5            |
        | A3            | 9                 | 3              | 6             | 33000      | 3           | 6               | 6            |
        | A4            | 6                 | 3              | 3             | 18000      | 4           | 7               | 3            |
        | B0            | 3                 | 1              | 2             | 10000      | 6           | 7               | 2            |
        | B2            | 5                 | 2              | 3             | 13500      | 3           | 5               | 3            |
      Y VENTAS_POR_VISITA de la visita queda con:
        | totalVendido          | 148500 |
        | totalVendidoProductos | 148500 |
        | unidadesVendidas      | 28     |
        | unidadesSugeridas     | 28     |
      Pero totalVendidoProductos no es 273500 y unidadesSugeridas no es 52
      Y las 24 unidades despachadas quedan en estadoCarga CARGADO con idGrupoCarga de esta visita

    @movil @despachos @regresion
    Escenario: Visita 2 con el pedido anterior aún sin despachar, la venta es la misma
      # Hoy este caso da sugerido 28 y el anterior 52: el resultado depende de cuándo despacha bodega.
      Dado que la visita anterior de la máquina cerró en PEDIDOS_OPERADOR con:
        | espiralCodigo | inventarioFinal | cantSugerida | estado    |
        | A0            | 13              | 2            | PENDIENTE |
        | A1            | 11              | 3            | PENDIENTE |
        | A2            | 10              | 3            | PENDIENTE |
        | A3            | 9               | 3            | PENDIENTE |
        | A4            | 6               | 4            | PENDIENTE |
        | B0            | 3               | 6            | PENDIENTE |
        | B2            | 5               | 3            | PENDIENTE |
      Y su nrActualMedido es 1125000 y su nrProductoMedido es 5024
      Y no hay despachos EN_TRANSITO para la máquina
      Cuando el operador registra la visita con el mismo conteo de la visita 2
      Y digita nrActual 1273500 y nrProducto 5052
      Y confirma la carga sin producto
      Entonces VENTAS_POR_VISITA de la visita queda con:
        | totalVendido          | 148500 |
        | totalVendidoProductos | 148500 |
        | unidadesVendidas      | 28     |
        | unidadesSugeridas     | 52     |
      Y el inventarioFinal total de la visita es 29
      Y las 7 líneas de la visita anterior pasan a estado CERRADO

    @movil @regresion
    Escenario: El sugerido no descuenta pedidos anteriores PENDIENTE o PARCIAL
      Dado que existe un pedido anterior PARCIAL de A0 con pendienteDesp 4
      Cuando el operador registra una visita y A0 cierra con inventarioFinal 8
      Entonces la cantSugerida de A0 es 7
      Pero no es 3, porque el pendiente anterior ya está incluido en capacidadMax - inventarioFinal
      # Se elimina ajustarSugerida() de operador-pedido.service.ts.

    @movil
    Esquema del escenario: El sugerido nunca es negativo ni supera la capacidad
      Dado un espiral ACTIVO con capacidadMax <capacidadMax>
      Cuando la visita cierra con inventarioFinal <inventarioFinal> en ese espiral
      Entonces la cantSugerida del espiral es <cantSugerida>

      Ejemplos:
        | capacidadMax | inventarioFinal | cantSugerida |
        | 15           | 15              | 0            |
        | 15           | 7               | 8            |
        | 15           | 0               | 15           |
        | 9            | 11              | 0            |

    @movil
    Escenario: Los cálculos son por espiral aunque el mismo producto esté en dos espirales
      Dado que "Coca Cola lata normal" también está en el espiral A5 con capacidadMax 10
      Y A4 tiene inventarioInicial 7 y A5 tiene inventarioInicial 10
      Cuando el operador registra fisicoDigitado 2 en A4 y 9 en A5
      Entonces ventaUnidades es 5 en A4 y 1 en A5
      Y cada espiral tiene su propia línea en PEDIDOS_OPERADOR con su idMapaMp
      # Hoy ajustarSugerida() y la búsqueda del mapa agrupan por idProducto.

    @movil @nuevo
    Escenario: Los retiros de vencidos o averiados no cuentan como venta
      Dado que A0 tiene inventarioInicial 7 y 4 unidades EN_TRANSITO
      Cuando el operador registra en A0 fisicoDigitado 4, retiros 1 con motivoRetiro "Vencido" y cantCargada 4
      Entonces A0 queda con ventaUnidades 3, inventarioFinal 7 y cantSugerida 8
      Y la unidad retirada no suma a ventaValor

    @movil @nuevo
    Escenario: Los retiros no pueden superar el conteo físico
      Cuando el operador registra en A0 fisicoDigitado 2 y retiros 3
      Entonces el sistema rechaza el registro con el mensaje "Los retiros no pueden superar el conteo físico"

    @movil @propuesta
    Escenario: Físico mayor que el inventario inicial
      Dado que A1 tiene inventarioInicial 11
      Cuando el operador registra fisicoDigitado 12 en A1
      Entonces ventaUnidades de A1 es 0
      Y se genera la novedad "Sobrante de inventario" por 1 unidad en A1
      Y inventarioFinal de A1 se calcula con el físico registrado

  # ---------------------------------------------------------------------------
  Regla: Registrar una visita cierra los pedidos anteriores y el faltante reaparece en el nuevo sugerido

    Antecedentes:
      Dado que la visita anterior de la máquina cerró en PEDIDOS_OPERADOR con:
        | espiralCodigo | inventarioFinal | cantSugerida |
        | A0            | 7               | 8            |
        | A1            | 13              | 1            |
        | A2            | 8               | 5            |
        | A3            | 6               | 6            |
        | A4            | 7               | 3            |
        | B0            | 7               | 2            |
        | B2            | 5               | 3            |
      Y su nrActualMedido es 1273500 y su nrProductoMedido es 5052
      Y bodega despachó contra ese pedido:
        | espiralCodigo | cantDespachada | pendienteDesp | estadoPedido |
        | A0            | 4              | 4             | PARCIAL      |
        | A1            | 1              | 0             | APROBADO     |
        | A2            | 5              | 0             | APROBADO     |
        | A3            | 6              | 0             | APROBADO     |
        | A4            | 3              | 0             | APROBADO     |
        | B0            | 0              | 2             | PENDIENTE    |
        | B2            | 3              | 0             | APROBADO     |
      Y las 22 unidades despachadas están en estadoCarga EN_TRANSITO

    @movil @despachos @regresion
    Escenario: Visita 3 con despacho parcial, el faltante no se acumula
      Cuando el operador registra la visita con este conteo:
        | espiralCodigo | fisicoDigitado |
        | A0            | 4              |
        | A1            | 11             |
        | A2            | 4              |
        | A3            | 4              |
        | A4            | 2              |
        | B0            | 3              |
        | B2            | 4              |
      Y digita nrActual 1385500 y nrProducto 5073
      Y confirma la carga de lo despachado sin cambios
      Entonces la visita queda con estas líneas en PEDIDOS_OPERADOR:
        | espiralCodigo | inventarioInicial | fisicoDigitado | ventaUnidades | ventaValor | cantCargada | inventarioFinal | cantSugerida |
        | A0            | 7                 | 4              | 3             | 16500      | 4           | 8               | 7            |
        | A1            | 13                | 11             | 2             | 10000      | 1           | 12              | 2            |
        | A2            | 8                 | 4              | 4             | 20000      | 5           | 9               | 4            |
        | A3            | 6                 | 4              | 2             | 11000      | 6           | 10              | 2            |
        | A4            | 7                 | 2              | 5             | 30000      | 3           | 5               | 5            |
        | B0            | 7                 | 3              | 4             | 20000      | 0           | 3               | 6            |
        | B2            | 5                 | 4              | 1             | 4500       | 3           | 7               | 1            |
      Y VENTAS_POR_VISITA de la visita queda con:
        | totalVendido          | 112000 |
        | totalVendidoProductos | 112000 |
        | unidadesVendidas      | 21     |
        | unidadesSugeridas     | 27     |
      Y los pedidos de A0 y B0 de la visita anterior pasan a estado CERRADO
      Y su pendienteDesp se conserva como histórico pero no se vuelve a pedir
      Y la cantSugerida de A0 es 7, que corresponde a 3 vendidas más 4 no despachadas
      Y la cantSugerida de B0 es 6, que corresponde a 4 vendidas más 2 no despachadas
      Y el informe "Vendido por Visita" muestra B0 con ventaUnidades 4 y ventaValor 20000 aunque no tuvo despacho

    @despachos @nuevo
    Escenario: Los pedidos cerrados ya no aparecen como pendientes de despacho
      Dado que el operador registró la visita 3
      Cuando bodega consulta GET /api/despachos/pendientes
      Entonces no aparecen los pedidos de A0 y B0 de la visita anterior
      Y aparecen los 7 pedidos de la visita 3

    @movil @despachos @nuevo
    Escenario: El operador no trae el despacho y el sugerido se recalcula solo
      Cuando el operador registra la visita con el conteo de la visita 3
      Y digita nrActual 1385500 y nrProducto 5073
      Y confirma cantCargada 0 en todos los espirales con la novedadCarga "No recibí el despacho"
      Entonces las 22 unidades despachadas pasan a estadoCarga DEVUELTO
      Y la bodega principal reingresa esas 22 unidades a stockActual
      Y VENTAS_POR_VISITA de la visita queda con:
        | totalVendido          | 112000 |
        | totalVendidoProductos | 112000 |
        | unidadesVendidas      | 21     |
        | unidadesSugeridas     | 49     |

    @despachos
    Escenario: El faltante nunca supera la capacidad aunque bodega no despache en varias visitas
      Dado que la bodega principal no tiene stock de "Fuze Tea surtido" desde hace varias visitas
      Y la última visita cerró B0 con inventarioFinal 1 y cantSugerida 8, sin despacho
      Cuando la visita siguiente registra fisicoDigitado 0 en B0 sin carga
      Entonces ventaUnidades de B0 es 1
      Y la cantSugerida de B0 es 9
      Y no queda pendiente acumulado de visitas anteriores para B0

  # ---------------------------------------------------------------------------
  Regla: Despachos descuenta de bodega sin negativos y sin superar el sugerido del pedido
    El cupo por pedido es min(stockActual del producto, cantSugerida - suma de cantDespachada del pedido).
    Como cantSugerida = capacidadMax - inventarioFinal, equivale a la regla A medida contra el inventario final.

    Antecedentes:
      Dado que la visita 2 de la máquina cerró con estos pedidos en estado PENDIENTE:
        | espiralCodigo | inventarioFinal | cantSugerida |
        | A0            | 7               | 8            |
        | A1            | 13              | 1            |
        | A2            | 8               | 5            |
        | A3            | 6               | 6            |
        | A4            | 7               | 3            |
        | B0            | 7               | 2            |
        | B2            | 5               | 3            |

    @despachos @existente
    Escenario: Despacho completo del sugerido
      Dado que la bodega principal tiene stock suficiente de todos los productos
      Cuando bodega envía POST /api/despachos con el sugerido completo de los 7 pedidos
      Entonces se crean 7 líneas en DESPACHOS_BODEGA con cantDespachada igual a cantSugerida
      Y cada línea guarda stockAntes y stockDespues del producto
      Y las líneas quedan en estadoCarga EN_TRANSITO
      Y el stockActual de los productos baja 28 unidades en total
      Y los 7 pedidos pasan a estado APROBADO con pendienteDesp 0

    @despachos @regresion
    Escenario: Despacho parcial por falta de stock, sin negativos y sin líneas en cero
      Dado que el stockActual de "Bonyurt Alpina" es 4 y el de "Fuze Tea surtido" es 0
      Y la bodega principal tiene stock suficiente del resto de productos
      Cuando bodega envía POST /api/despachos con el sugerido completo de los 7 pedidos
      Entonces se crean líneas en DESPACHOS_BODEGA:
        | espiralCodigo | cantSugerida | cantDespachada | pendienteDesp |
        | A0            | 8            | 4              | 4             |
        | A1            | 1            | 1              | 0             |
        | A2            | 5            | 5              | 0             |
        | A3            | 6            | 6              | 0             |
        | A4            | 3            | 3              | 0             |
        | B2            | 3            | 3              | 0             |
      Y no se crea línea en DESPACHOS_BODEGA para B0
      Y el pedido de A0 queda PARCIAL y el de B0 queda PENDIENTE
      Y el stockActual de "Bonyurt Alpina" y "Fuze Tea surtido" queda en 0
      Y ningún producto queda con stockActual negativo

    @despachos @regresion
    Escenario: Un segundo despacho completa el pedido parcial
      # Hoy pendienteDesp = cantSugerida - cantDespachada de ese despacho; daría 4 y dejaría el pedido PARCIAL.
      Dado que el pedido de A0 tiene un despacho de 4 unidades contra una cantSugerida de 8
      Y el stockActual de "Bonyurt Alpina" sube a 10
      Cuando bodega despacha el pendiente del pedido de A0
      Entonces el cupo disponible para el pedido de A0 es 4
      Y la nueva línea queda con cantDespachada 4 y pendienteDesp 0
      Y el pedido de A0 pasa a estado APROBADO

    @despachos @existente
    Escenario: No se puede despachar más que el cupo del pedido
      Dado que el stockActual de "Bonyurt Alpina" es 50
      Cuando bodega intenta despachar 10 unidades en el pedido de A0
      Entonces el sistema solo despacha 8 unidades en el pedido de A0

    @despachos @regresion
    Escenario: Un espiral lleno no recibe despacho
      # Hoy, si fisicoDigitado + despachado >= capacidadMax, cupoRestante queda igual al stock y no limita.
      Dado que el pedido de A1 tiene inventarioFinal 14 y cantSugerida 0
      Cuando bodega intenta despachar 3 unidades en el pedido de A1
      Entonces el cupo disponible es 0
      Y no se crea línea en DESPACHOS_BODEGA para A1

    @despachos @propuesta
    Escenario: Dos despachos simultáneos no dejan el stock en negativo
      Dado que el stockActual de "Coca Cola lata normal" es 3
      Cuando dos usuarios de bodega despachan al mismo tiempo 3 unidades cada uno para máquinas distintas
      Entonces solo uno de los despachos descuenta las 3 unidades
      Y el otro queda limitado al stock que quede disponible
      Y el stockActual nunca queda negativo

  # ---------------------------------------------------------------------------
  Regla: Cada línea de despacho cambia de estado según lo que el operador confirma al cargar
    EN_TRANSITO al despachar. CARGADO cuando el operador confirma la carga total o parcial en su visita.
    DEVUELTO cuando no se cargó ninguna unidad. Lo no cargado reingresa a stockActual del producto.

    @despachos @movil @nuevo
    Escenario: Confirmar la carga sin cambios pasa las líneas a CARGADO
      Dado que existen líneas EN_TRANSITO para la máquina
      Cuando el operador guarda la visita con la carga prellenada sin cambios
      Entonces todas las líneas pasan a CARGADO con cantCargada igual a cantDespachada
      Y su idGrupoCarga es el idGrupo de la visita
      Y la cantCargada de cada espiral en PEDIDOS_OPERADOR es la suma de sus líneas

    @despachos @movil @nuevo
    Escenario: Carga parcial de una línea
      Dado que existe una línea EN_TRANSITO de 3 unidades para A4
      Cuando el operador guarda la visita con cantCargada 2 en A4 y la novedadCarga "Producto devuelto a bodega"
      Entonces la línea de A4 queda CARGADO con cantCargada 2 y cantDevuelta 1
      Y el stockActual de "Coca Cola lata normal" sube 1 unidad
      Y la cantCargada de A4 en PEDIDOS_OPERADOR es 2

    @despachos @movil @propuesta
    Escenario: Carga mayor a lo despachado
      Dado que existe una línea EN_TRANSITO de 3 unidades para A4
      Cuando el operador guarda la visita con cantCargada 4 en A4 y la novedadCarga "Carga mayor a lo despachado"
      Entonces la cantCargada de A4 en PEDIDOS_OPERADOR es 4
      Y se genera una alerta para bodega por 1 unidad cargada sin despacho registrado

  # ---------------------------------------------------------------------------
  Regla: "No reponer" pasa de Despachos al mapa de la máquina

    @despachos @regresion
    Escenario: Despachos ya no ofrece la acción "No reponer"
      Cuando bodega abre la tabla de Despachos de la máquina
      Entonces no existe la acción "No reponer" por espiral
      Y POST /api/despachos no acepta el campo noReponer
      Y no se crean registros de DESPACHOS_BODEGA con cantDespachada 0

    @mapa @nuevo
    Escenario: Marcar un espiral como NO_REPONER en el mapa
      Dado que el administrador marca A3 con estadoEspiral NO_REPONER y motivoEstado "Producto descontinuado"
      Y A3 tiene inventarioInicial 6
      Cuando el operador registra fisicoDigitado 4 en A3
      Entonces ventaUnidades de A3 es 2
      Y la cantSugerida de A3 es 0
      Y el pedido de A3 no aparece en GET /api/despachos/pendientes

    @mapa @nuevo
    Escenario: Reactivar un espiral
      Dado que A3 tiene estadoEspiral NO_REPONER
      Cuando el administrador cambia A3 a ACTIVO
      Entonces en la siguiente visita la cantSugerida de A3 vuelve a ser capacidadMax - inventarioFinal

  # ---------------------------------------------------------------------------
  Regla: Precio y capacidad se copian en cada línea de la visita

    @recaudo @nuevo
    Escenario: Un cambio en PRECIOS_CLIENTE no altera visitas pasadas
      Dado que la visita 3 guardó precioVigente 6000 en A4
      Cuando se aplica un aumento de IPC y el precioVenta de "Coca Cola lata normal" pasa a 6500
      Entonces la visita 3 conserva precioVigente 6000 en A4
      Y su ventaValor y el totalVendidoProductos de la visita no cambian

    @recaudo @nuevo
    Escenario: La venta en valor usa el precio vigente durante el intervalo
      Dado que la visita 2 guardó precioVigente 6000 en A4
      Y el precioVenta de "Coca Cola lata normal" cambió a 6500 antes de la visita 3
      Cuando la visita 3 registra ventaUnidades 5 en A4
      Entonces la ventaValor de A4 en la visita 3 es 30000
      Y la visita 3 guarda precioVigente 6500 en A4 para valorizar la venta de la visita 4

    @mapa
    Escenario: Un cambio de capacidad solo afecta el sugerido
      Dado que la capacidadMax de B0 cambió de 9 a 12 antes de la visita 3
      Y B0 tiene inventarioInicial 7
      Cuando la visita 3 registra fisicoDigitado 3 en B0 sin carga
      Entonces ventaUnidades de B0 es 4
      Y inventarioFinal de B0 es 3
      Y la cantSugerida de B0 es 9

    @recaudo @propuesta
    Escenario: Un producto sin precio para el cliente no se valoriza con el costo
      # Hoy el código usa costoBase cuando no hay precio en PRECIOS_CLIENTE.
      Dado que "Jugo Valle Fress" no tiene precio en PRECIOS_CLIENTE para "CLIENTE-TEST"
      Cuando la visita registra ventaUnidades 3 en B2
      Entonces la ventaValor de B2 es 0
      Y se genera la alerta "Producto sin precio para el cliente" en la visita

  # ---------------------------------------------------------------------------
  Regla: VENTAS_POR_VISITA guarda la venta real al registrar y el informe no la recalcula

    @recaudo @regresion
    Escenario: Despachar no modifica la venta por producto de una visita
      Dado que la visita 2 quedó con totalVendidoProductos 148500
      Cuando bodega despacha el sugerido de la visita 2
      Y tesorería consulta GET /api/tesoreria/vendido-por-visita
      Entonces la visita 2 sigue mostrando totalVendidoProductos 148500

    @recaudo @regresion
    Escenario: Consultar el informe no escribe en la base de datos
      Cuando tesorería consulta GET /api/tesoreria/vendido-por-visita
      Entonces no se crea ni se actualiza ningún registro de VENTAS_POR_VISITA
      # Hoy la consulta hace upsert (backfill) y reescribe totalVendidoProductos.

    @recaudo
    Escenario: El informe muestra el desglose por espiral
      Cuando tesorería abre el detalle de la visita 3 en "Vendido por Visita"
      Entonces ve por espiral inventarioInicial, fisicoDigitado, ventaUnidades, precioVigente, ventaValor, cantCargada, inventarioFinal y cantSugerida
      Y ve aparte lo despachado y el pendienteDesp contra el sugerido de la visita

    @recaudo @propuesta
    Escenario: Transición de visitas registradas antes de la corrección
      Dado que la última visita de una máquina se registró con el modelo anterior, con fisicoDigitado total 29
      Y contra el pedido de la visita previa a esa se despacharon 24 unidades
      Cuando el operador registra la primera visita con el modelo nuevo
      Entonces el inventarioInicial total se toma como 53, el físico de la última visita más lo despachado contra la visita previa
      Y las visitas registradas antes de la corrección se muestran marcadas como "Modelo anterior" y no se recalculan

  # ---------------------------------------------------------------------------
  Regla: Recaudo cruza la diferencia de NR contra la venta calculada por inventario

    Antecedentes:
      Dado que la visita 1 registró nrActualMedido 1125000 y nrProductoMedido 5024
      Y la visita 2 registró nrActualMedido 1273500 y nrProductoMedido 5052
      Y la visita 2 tiene totalVendidoProductos 148500 y unidadesVendidas 28

    @recaudo @regresion
    Escenario: El NR anterior del recaudo es el de la visita anterior
      # Hoy createEfectivoNr puede tomar ultimoContadorNR, que el registro de la visita ya sobrescribió.
      Dado que MAQUINAS_Y_TIENDAS.ultimoContadorNR ya quedó en 1273500 al registrar la visita 2
      Cuando tesorería registra el recaudo de la visita 2 sin enviar nrAnterior
      Entonces el recaudo toma nrAnterior 1125000 y diferenciaNr 148500
      Pero diferenciaNr no es 0

    @recaudo @regresion
    Escenario: Cruce de valor de la visita 2
      Cuando tesorería abre el cuadre de la visita 2
      Entonces la diferencia de NR es 148500
      Y la venta por producto en valor es 148500
      Y la diferencia del cruce de valor es 0
      Pero la venta por producto en valor no es 273500

    @recaudo @nuevo
    Escenario: Cruce de unidades de la visita 2
      Cuando tesorería abre el cuadre de la visita 2
      Entonces la diferencia de NR producto es 28
      Y la venta por producto en unidades es 28
      Y la diferencia del cruce de unidades es 0

    @recaudo @nuevo
    Esquema del escenario: Lectura de la diferencia en el cruce de unidades
      Dado que la diferencia de NR producto de una visita es <diferenciaNrProducto>
      Y la venta por inventario de esa visita es <unidadesVendidas> unidades
      Cuando tesorería abre el cuadre de la visita
      Entonces el cruce de unidades muestra el resultado "<resultado>"

      Ejemplos:
        | diferenciaNrProducto | unidadesVendidas | resultado                                                                                   |
        | 28                   | 28               | Cuadrado                                                                                    |
        | 25                   | 28               | Salió producto sin venta: revisar conteo, robo, producto atascado o retiros no registrados |
        | 30                   | 28               | Posible carga sin registrar                                                                 |

    @recaudo @nuevo
    Escenario: Opciones en precio 0 facturadas al cliente
      Dado que "Jugo Valle Fress" tiene precioVenta 0 en PRECIOS_CLIENTE por negociación con el cliente
      Y la visita registra ventaUnidades 3 en B2
      Cuando tesorería abre el cuadre de la visita
      Entonces B2 aporta 0 al cruce de valor
      Y B2 aporta 3 unidades al cruce de unidades
      Y las 3 unidades de B2 se reportan como "Unidades a facturar al cliente"

  # ---------------------------------------------------------------------------
  Regla: En máquinas de café el consumo sale de la diferencia de NRQ por botón

    @movil @pendiente-definicion
    Escenario: El consumo de materia prima usa la diferencia de NRQ y no la lectura
      # Hoy operador-pedido.service.ts toma nrqItems[].valor como unidades vendidas. Si el NRQ es un
      # contador acumulado (así lo trata TESORERIA_FACTURACION_NRQ con NRQ inicial y final),
      # el consumo queda sobrestimado desde la segunda visita.
      Dada la máquina "MAQ-CAFE" de tipo "CAFE" con el botón "B1" en MAPA_CAFE_NRQ
      Y la lectura NRQ del botón "B1" en la visita anterior fue 1200
      Cuando el operador digita la lectura NRQ 1250 en el botón "B1"
      Entonces las bebidas vendidas del botón "B1" en la visita son 50
      Y el consumo de cada materia prima es 50 x cantidadDosis de su receta
      Y la lectura 1250 queda guardada como base de la visita siguiente

  # ---------------------------------------------------------------------------
  Regla: La cadena de visitas no se rompe por correcciones posteriores

    @movil @propuesta
    Escenario: Solo se puede corregir la última visita sin recaudo cerrado y sin despachos
      Dado que la visita 3 es la última de la máquina
      Y no tiene recaudo en estado CERRADO en TESORERIA_EFECTIVO_NR
      Y no hay despachos contra sus pedidos
      Cuando un usuario corrige el fisicoDigitado de A0 en la visita 3
      Entonces se recalculan ventaUnidades, ventaValor, inventarioFinal y cantSugerida de A0 en la visita 3
      Y se recalculan los totales de VENTAS_POR_VISITA de la visita 3
      Y la corrección queda en AUDITORIA_LOG con usuario, fecha y valor anterior

    @recaudo @propuesta
    Escenario: Una visita con recaudo cerrado no se puede modificar
      Dado que la visita 2 tiene recaudo en estado CERRADO
      Cuando un usuario intenta modificar el conteo de la visita 2
      Entonces el sistema rechaza la modificación
      Y el intento queda registrado en AUDITORIA_LOG
