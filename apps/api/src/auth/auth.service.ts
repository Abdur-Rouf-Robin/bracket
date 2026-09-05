import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { LoginInput, RegisterInput } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../account/account.service';
import type { AccountUser } from '../account/account.service';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly account: AccountService,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        lastLoginAt: new Date(),
      },
    });
    // Fire-and-forget: registration must not fail if the email provider is down.
    this.account.sendVerificationEmail(user.id).catch((err: Error) => {
      this.logger.warn(`Verification email failed for ${user.email}: ${err.message}`);
    });
    return this.tokenResponse(user);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.tokenResponse(user);
  }

  /** Full AccountUser shape (id, email, name, username, avatarUrl, bio, timezone, locale, plan, planExpiresAt, emailVerified, role, countryCode, createdAt). */
  async me(id: string): Promise<{ user: AccountUser }> {
    const user = await this.account.getAccount(id);
    return { user };
  }

  forgotPassword(email: string) {
    return this.account.requestPasswordReset(email);
  }

  resetPassword(token: string, password: string) {
    return this.account.resetPassword(token, password);
  }

  private async tokenResponse(user: AuthUser) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const account = await this.account.getAccount(user.id);
    return {
      accessToken,
      user: account,
    };
  }
}
