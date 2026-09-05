import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { tournamentSettingsSchema } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { signViewToken } from './view-token.util';

@Injectable()
export class ViewPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Owner sets (or clears with null) the spectator password. */
  async setPassword(tournamentId: string, userId: string, password: string | null) {
    const t = await this.access.requireTournamentOwner(tournamentId, userId);
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    const hash = password ? await bcrypt.hash(password, 10) : null;
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        viewPasswordHash: hash,
        settings: { ...settings, viewPasswordEnabled: !!hash },
      },
    });
    return { ok: true, enabled: !!hash };
  }

  /** Spectator submits the password; returns a 7-day view token. */
  async unlock(slug: string, password: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, slug: true, isPublic: true, viewPasswordHash: true, settings: true },
    });
    if (!t || !t.isPublic) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!t.viewPasswordHash || !settings.viewPasswordEnabled) {
      // Nothing to unlock — still hand out a token so clients can proceed.
      return { viewToken: signViewToken(t.slug), required: false };
    }
    const ok = await bcrypt.compare(password, t.viewPasswordHash);
    if (!ok) throw new UnauthorizedException('Incorrect password');
    return { viewToken: signViewToken(t.slug), required: true };
  }
}
