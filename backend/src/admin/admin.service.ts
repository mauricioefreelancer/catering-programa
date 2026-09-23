import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRolDto, UpdateRolDto, CreateUsuarioDto, UpdateUsuarioDto, QueryAdminDto } from './dto/admin.dto';
import * as bcrypt from 'bcrypt';

const PROTECTED_TABLES = ['AUDITORIA_LOG'];

function firstNonEmpty(...vals: any[]): any {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return undefined;
}

function normalizeUsuarioInputLegacy(dto: CreateUsuarioDto | UpdateUsuarioDto) {
  const nombreCompleto = firstNonEmpty(dto.nombreCompleto, dto.nombre);
  const usuarioLogin = firstNonEmpty(dto.usuarioLogin, dto.usuario_login);
  let idRol = firstNonEmpty(dto.idRol, dto.id_rol);
  if (idRol !== undefined && typeof idRol !== 'number') {
    const parsed = Number(idRol);
    if (!isNaN(parsed)) idRol = parsed; else idRol = undefined;
  }
  const estado = firstNonEmpty(dto.estado, true);
  const email = firstNonEmpty(dto.email);
  const password = firstNonEmpty(dto.password);
  return { nombreCompleto, usuarioLogin, idRol, estado, email, password };
}
const ALLOWED_SCHEMA = 'public';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAllRoles(query: QueryAdminDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.search) where.nombreRol = { contains: query.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.rolesPerfiles.findMany({ skip, take, where, orderBy: { fechaCreacion: 'desc' } }),
      this.prisma.rolesPerfiles.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOneRol(id: number) {
    const r = await this.prisma.rolesPerfiles.findUnique({ where: { idRol: id } });
    if (!r) throw new NotFoundException('Rol no encontrado');
    return r;
  }

  async createRol(dto: CreateRolDto) {
    const exists = await this.prisma.rolesPerfiles.findUnique({ where: { nombreRol: dto.nombreRol } });
    if (exists) throw new ConflictException('Rol ya existe');
    return this.prisma.rolesPerfiles.create({ data: dto });
  }

  async updateRol(id: number, dto: UpdateRolDto) {
    await this.findOneRol(id);
    return this.prisma.rolesPerfiles.update({ where: { idRol: id }, data: dto });
  }

  async removeRol(id: number) {
    await this.findOneRol(id);
    return this.prisma.rolesPerfiles.delete({ where: { idRol: id } });
  }

  async findAllUsuarios(query: QueryAdminDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { nombreCompleto: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { usuarioLogin: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.usuariosSistema.findMany({ skip, take, where, include: { rol: true, operador: true }, orderBy: { fechaCreacion: 'desc' } }),
      this.prisma.usuariosSistema.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOneUsuario(id: number) {
    const u = await this.prisma.usuariosSistema.findUnique({ where: { idUsuario: id }, include: { rol: true } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async createUsuario(dto: CreateUsuarioDto) {
    const norm = normalizeUsuarioInputLegacy(dto);
    const errores: string[] = [];
    if (!norm.idRol) errores.push('idRol es requerido');
    if (!norm.nombreCompleto) errores.push('nombreCompleto o nombre es requerido');
    if (!norm.usuarioLogin) errores.push('usuarioLogin o usuario_login es requerido');
    if (!norm.email) errores.push('email es requerido');
    if (!norm.password) errores.push('password es requerido');
    if (errores.length > 0) throw new BadRequestException(errores.join(', '));
    const exists = await this.prisma.usuariosSistema.findFirst({
      where: { OR: [{ email: norm.email }, { usuarioLogin: norm.usuarioLogin }] },
      include: { rol: true, operador: true },
    });
    if (exists) {
      const dupEmail = String(exists.email || '').toLowerCase() === String(norm.email || '').toLowerCase();
      const dupUser = String(exists.usuarioLogin || '').toLowerCase() === String(norm.usuarioLogin || '').toLowerCase();
      const existIdRol4 = Number(exists.idRol) === 4 || String(exists.rol?.nombreRol || '').toUpperCase().includes('OPERADOR');
      const nuevoIdRol4 = Number(norm.idRol) === 4;
      if (existIdRol4 && nuevoIdRol4) {
        const dataUpdate: any = {};
        if (norm.nombreCompleto) dataUpdate.nombreCompleto = norm.nombreCompleto;
        if (norm.estado !== undefined) dataUpdate.estado = norm.estado;
        if (norm.password) dataUpdate.passwordHash = await bcrypt.hash(norm.password, 10);
        if (Object.keys(dataUpdate).length > 0) {
          await this.prisma.usuariosSistema.update({ where: { idUsuario: exists.idUsuario }, data: dataUpdate });
        }
        return this.findOneUsuario(exists.idUsuario);
      }
      const partes: string[] = [];
      if (dupEmail) partes.push(`El email "${norm.email}" ya está registrado a nombre de ${exists.nombreCompleto || exists.usuarioLogin || '(sin nombre)'} (Rol: ${exists.rol?.nombreRol || 'Desconocido'}).`);
      if (dupUser) partes.push(`El usuario login "${norm.usuarioLogin}" ya está en uso por ${exists.nombreCompleto || exists.email || '(sin nombre)'} (Rol: ${exists.rol?.nombreRol || 'Desconocido'}).`);
      if (partes.length === 0) partes.push('El email o usuario ya existen.');
      partes.push('Cambie el dato que esté repetido o (si es el mismo operador) use Editar en lugar de Nuevo.');
      throw new ConflictException(partes.join(' '));
    }
    const hash = await bcrypt.hash(norm.password, 10);
    return this.prisma.usuariosSistema.create({
      data: {
        idRol: norm.idRol,
        nombreCompleto: norm.nombreCompleto,
        usuarioLogin: norm.usuarioLogin,
        email: norm.email,
        passwordHash: hash,
        estado: norm.estado,
      },
      include: { rol: true },
    });
  }

  async updateUsuario(id: number, dto: UpdateUsuarioDto) {
    await this.findOneUsuario(id);
    const norm = normalizeUsuarioInputLegacy(dto);
    const data: any = {};
    if (norm.nombreCompleto !== undefined) data.nombreCompleto = norm.nombreCompleto;
    if (norm.usuarioLogin !== undefined) data.usuarioLogin = norm.usuarioLogin;
    if (norm.email !== undefined) data.email = norm.email;
    if (norm.idRol !== undefined) data.idRol = norm.idRol;
    if (norm.estado !== undefined) data.estado = norm.estado;
    if (dto.permisosExcepcion !== undefined) data.permisosExcepcion = dto.permisosExcepcion;
    if (norm.password) data.passwordHash = await bcrypt.hash(norm.password, 10);
    return this.prisma.usuariosSistema.update({ where: { idUsuario: id }, data, include: { rol: true } });
  }

  async removeUsuario(id: number) {
    await this.findOneUsuario(id);
    return this.prisma.usuariosSistema.delete({ where: { idUsuario: id } });
  }

  // =========== META TABLAS (Panel de Datos Maestro) ======================
  private checkTableName(table: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new BadRequestException('Nombre de tabla inválido');
  }
  private checkTableMutable(table: string) {
    this.checkTableName(table);
    if (PROTECTED_TABLES.includes(table)) throw new ForbiddenException('Tabla protegida (solo lectura)');
  }
  private sanitizeRow(row: any): any {
    if (row === null || row === undefined) return row;
    if (typeof row === 'bigint') return Number.isSafeInteger(Number(row)) ? Number(row) : row.toString();
    if (Array.isArray(row)) return row.map(this.sanitizeRow.bind(this));
    if (typeof row === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(row)) out[k] = this.sanitizeRow(row[k]);
      return out;
    }
    return row;
  }

  async listTables() {
    const sql = `
      SELECT c.relname AS "tableName",
             obj_description(c.oid, 'pg_class') AS "comment",
             (SELECT COUNT(*) FROM pg_class c2 WHERE c2.relname = c.relname AND c2.relkind = 'r') AS _ok,
             0::bigint AS "rowCount"
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'r' AND c.relname NOT LIKE '_prisma%' AND c.relname NOT LIKE 'pg_%'
      ORDER BY c.relname;`;
    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ALLOWED_SCHEMA);
    for (const r of rows) {
      try {
        const cnt = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS c FROM "${ALLOWED_SCHEMA}"."${r.tableName}"`);
        r.rowCount = (cnt as any)[0].c;
      } catch { r.rowCount = 0; }
    }
    const fksSql = `
      SELECT tc.table_name AS "tableName", kcu.column_name AS "columnName",
             ccu.table_name  AS "foreignTableName", ccu.column_name AS "foreignColumnName",
             tc.constraint_name AS "constraintName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage       kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
      ORDER BY tc.table_name, kcu.ordinal_position;`;
    const fks: any[] = await this.prisma.$queryRawUnsafe(fksSql, ALLOWED_SCHEMA);
    const colsSql = `
      SELECT table_name AS "tableName", column_name AS "columnName", data_type AS "dataType",
             is_nullable AS "isNullable", column_default AS "columnDefault",
             character_maximum_length AS "charMaxLen", ordinal_position AS "ordinalPosition"
      FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position;`;
    const cols: any[] = await this.prisma.$queryRawUnsafe(colsSql, ALLOWED_SCHEMA);
    const pkSql = `
      SELECT tc.table_name AS "tableName", kcu.column_name AS "columnName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1
      ORDER BY tc.table_name, kcu.ordinal_position;`;
    const pks: any[] = await this.prisma.$queryRawUnsafe(pkSql, ALLOWED_SCHEMA);
    return {
      tables: rows.map(r => ({
        tableName: r.tableName,
        comment: r.comment,
        rowCount: typeof r.rowCount === 'bigint' ? Number(r.rowCount) : r.rowCount,
        protected: PROTECTED_TABLES.includes(r.tableName),
      })),
      foreignKeys: fks,
      columns: cols,
      primaryKeys: pks,
    };
  }

  async selectTable(table: string, query: any) {
    this.checkTableName(table);
    const skip = parseInt(query.skip) || 0;
    const take = Math.min(parseInt(query.take) || 100, 500);
    const search = query.search || '';
    const cols: any[] = (await this.prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
      ALLOWED_SCHEMA, table,
    )) as any[];
    const colList = cols.map(c => `"${c.column_name}"`).join(', ');
    const whereLike = search ? ` WHERE (${cols.map(c => `CAST("${c.column_name}" AS TEXT) ILIKE '%${search.replace(/'/g, "''")}%'`).join(' OR ')})` : '';
    const limit = ` LIMIT ${take} OFFSET ${skip}`;
    let data: any[] = [];
    try {
      data = (await this.prisma.$queryRawUnsafe(`SELECT ${colList} FROM "${ALLOWED_SCHEMA}"."${table}"${whereLike}${limit}`)) as any[];
    } catch (e: any) { throw new BadRequestException('Error en consulta: ' + e.message); }
    let total = 0;
    try {
      const t = (await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS c FROM "${ALLOWED_SCHEMA}"."${table}"${whereLike}`)) as any[];
      total = Number(t[0].c);
    } catch { total = 0; }
    return { data: data.map(r => this.sanitizeRow(r)), total, skip, take };
  }

  async insertRow(table: string, body: any) {
    this.checkTableMutable(table);
    const cols = Object.keys(body);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const colNames = cols.map(c => `"${c}"`).join(', ');
    const values = cols.map(c => body[c]);
    const sql = `INSERT INTO "${ALLOWED_SCHEMA}"."${table}" (${colNames}) VALUES (${placeholders}) RETURNING *`;
    try {
      const r = await this.prisma.$queryRawUnsafe(sql, ...values);
      return { ok: true, row: this.sanitizeRow((r as any[])[0]) };
    } catch (e: any) {
      throw new BadRequestException('Error al insertar: ' + e.message);
    }
  }

  async updateRow(table: string, idCols: Record<string, any>, body: any) {
    this.checkTableMutable(table);
    if (!idCols || Object.keys(idCols).length === 0) throw new BadRequestException('Falta(s) columna(s) PK para editar');
    const setCols = Object.keys(body).map((c, i) => `"${c}" = $${i + 1}`).join(', ');
    const setVals = Object.keys(body).map(c => body[c]);
    const pkStart = setVals.length + 1;
    const pkWhere = Object.keys(idCols).map((c, i) => `"${c}" = $${pkStart + i}`).join(' AND ');
    const pkVals = Object.keys(idCols).map(c => idCols[c]);
    const sql = `UPDATE "${ALLOWED_SCHEMA}"."${table}" SET ${setCols} WHERE ${pkWhere} RETURNING *`;
    try {
      const r = await this.prisma.$queryRawUnsafe(sql, ...setVals, ...pkVals);
      if ((r as any[]).length === 0) throw new NotFoundException('Registro no encontrado');
      return { ok: true, row: this.sanitizeRow((r as any[])[0]) };
    } catch (e: any) {
      if (e instanceof NotFoundException) throw e;
      throw new BadRequestException('Error al actualizar: ' + e.message);
    }
  }

  async deleteRow(table: string, idCols: Record<string, any>) {
    this.checkTableMutable(table);
    if (!idCols || Object.keys(idCols).length === 0) throw new BadRequestException('Falta(s) columna(s) PK para eliminar');
    const pkVals = Object.keys(idCols).map(c => idCols[c]);
    const pkWhere = Object.keys(idCols).map((c, i) => `"${c}" = $${i + 1}`).join(' AND ');
    const sql = `DELETE FROM "${ALLOWED_SCHEMA}"."${table}" WHERE ${pkWhere} RETURNING *`;
    try {
      const r = await this.prisma.$queryRawUnsafe(sql, ...pkVals);
      if ((r as any[]).length === 0) throw new NotFoundException('Registro no encontrado');
      return { ok: true, deleted: this.sanitizeRow((r as any[])[0]) };
    } catch (e: any) {
      if (e instanceof NotFoundException) throw e;
      throw new BadRequestException('Error al eliminar: ' + e.message);
    }
  }
}
