import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePedidoOperadorDto } from './operador-pedido.dto';

const idEnvio = 'aee5d36f-8573-448b-b343-9cf1cfe02ed9';
const base = { idMaquina: 1, idOperador: 1, items: [] };

describe('Contrato de registro de visita', () => {
  it('acepta el ID de envio y la lectura NR efectivo', async () => {
    const dto = plainToInstance(CreatePedidoOperadorDto, { ...base, idEnvio, nrEfectivoActual: 0 });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
  });

  it('rechaza un envio que solo trae los campos de compatibilidad retirados', async () => {
    const dto = plainToInstance(CreatePedidoOperadorDto, { ...base, idOffline: idEnvio, nrActual: 0 });
    const errores = await validate(dto, { whitelist: true });
    expect(errores.map(e => e.property)).toEqual(expect.arrayContaining(['idEnvio', 'nrEfectivoActual']));
  });
});
