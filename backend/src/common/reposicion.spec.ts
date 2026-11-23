import { calcularDespacho, EstadoPedido, pendientePedido, sugeridoPorEspiral } from './reposicion';

const base = { sugerido: 10, acumulado: 0, capacidad: 12, fisico: 2, stock: 100 };

describe('Reposicion por espiral', () => {
  it('despacha tres y luego siete sin volver a contar el primer despacho', () => {
    expect(calcularDespacho({ ...base, stock: 3 })).toEqual({
      cantidad: 3, pendiente: 7, estado: EstadoPedido.PARCIAL,
    });
    expect(calcularDespacho({ ...base, acumulado: 3 })).toEqual({
      cantidad: 7, pendiente: 0, estado: EstadoPedido.APROBADO,
    });
  });

  it('aplica el cupo del espiral aunque haya stock suficiente', () => {
    expect(calcularDespacho({ ...base, fisico: 5, sugerido: 7 }).cantidad).toBe(7);
    expect(calcularDespacho({ ...base, fisico: 12 }).cantidad).toBe(0);
  });

  it('calcula el nuevo pedido sin cargarle el faltante historico', () => {
    expect(pendientePedido(7, 3)).toBe(4);
    expect(sugeridoPorEspiral(12, 2)).toBe(10);
  });

  it('distingue una decision de no reponer de la falta de stock', () => {
    expect(calcularDespacho({ ...base, stock: 0 }).estado).toBe(EstadoPedido.PARCIAL);
    expect(calcularDespacho({ ...base, noReponer: true })).toEqual({
      cantidad: 0, pendiente: 10, estado: EstadoPedido.NO_REPONER,
    });
    expect(sugeridoPorEspiral(12, 2)).toBe(10);
  });

  it.each([-1, 13, 2.5])('rechaza un fisico invalido (%s)', (fisico) => {
    expect(() => sugeridoPorEspiral(12, fisico)).toThrow(RangeError);
  });
});
