import type { PrismaClient } from '@prisma/client'
import type { AdminEntity } from '../../shared/entities.js'

export interface AdminRepository {
  findByEmail(email: string): Promise<AdminEntity | null>
  findById(id: string): Promise<AdminEntity | null>
}

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}
  findByEmail(email: string) { return this.prisma.admin.findUnique({ where: { email } }) }
  findById(id: string) { return this.prisma.admin.findUnique({ where: { id } }) }
}
