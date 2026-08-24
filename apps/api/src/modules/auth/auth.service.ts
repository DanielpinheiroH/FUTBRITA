import bcrypt from 'bcryptjs'
import type { AdminRepository } from '../admins/admin.repository.js'
import { AppError } from '../../shared/errors.js'

export class AuthService {
  constructor(private readonly admins: AdminRepository) {}

  async login(email: string, senha: string) {
    const admin = await this.admins.findByEmail(email)
    if (!admin || !admin.ativo || !(await bcrypt.compare(senha, admin.senhaHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos')
    }
    return admin
  }
}
