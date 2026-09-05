import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  addCommunityMemberSchema,
  communityAnnouncementSchema,
  communityListQuerySchema,
  createCommunitySchema,
  setCommunityGamesSchema,
  transferCommunityOwnershipSchema,
  updateCommunityAnnouncementSchema,
  updateCommunityMemberSchema,
  updateCommunitySchema,
  type AddCommunityMemberInput,
  type CommunityAnnouncementInput,
  type CommunityListQuery,
  type CreateCommunityInput,
  type UpdateCommunityInput,
  type UpdateCommunityMemberInput,
} from '@bracket/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommunitiesService } from './communities.service';

type MaybeUser = { id: string } | null | undefined;

@ApiTags('communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(communityListQuerySchema)) query: CommunityListQuery) {
    return this.communities.list(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: { id: string }) {
    return this.communities.mine(user.id);
  }

  @Get('slug-check')
  slugCheck(@Query('slug') slug = '', @Query('excludeId') excludeId?: string) {
    return this.communities.slugAvailable(slug, excludeId || undefined);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createCommunitySchema)) body: CreateCommunityInput,
  ) {
    return this.communities.create(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateCommunitySchema)) body: UpdateCommunityInput,
  ) {
    return this.communities.update(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.communities.remove(id, user.id);
  }

  // Members -----------------------------------------------------------------

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/members')
  members(@Param('id') id: string, @CurrentUser() user: MaybeUser) {
    return this.communities.listMembers(id, user?.id ?? null);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(addCommunityMemberSchema)) body: AddCommunityMemberInput,
  ) {
    return this.communities.addMember(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:memberId')
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateCommunityMemberSchema)) body: UpdateCommunityMemberInput,
  ) {
    return this.communities.updateMember(id, memberId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communities.removeMember(id, memberId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/transfer-ownership')
  transferOwnership(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(transferCommunityOwnershipSchema))
    body: z.infer<typeof transferCommunityOwnershipSchema>,
  ) {
    return this.communities.transferOwnership(id, user.id, body.userId);
  }

  // Follow ------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.communities.follow(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  unfollow(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.communities.unfollow(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/followers')
  followers(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.communities.listFollowers(id, user.id);
  }

  // Games -------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/games')
  setGames(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(setCommunityGamesSchema))
    body: z.infer<typeof setCommunityGamesSchema>,
  ) {
    return this.communities.setGames(id, user.id, body.gameIds);
  }

  // Announcements -----------------------------------------------------------

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/announcements')
  announcements(@Param('id') id: string, @CurrentUser() user: MaybeUser) {
    return this.communities.listAnnouncements(id, user?.id ?? null);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/announcements')
  createAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(communityAnnouncementSchema)) body: CommunityAnnouncementInput,
  ) {
    return this.communities.createAnnouncement(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/announcements/:announcementId')
  updateAnnouncement(
    @Param('id') id: string,
    @Param('announcementId') announcementId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateCommunityAnnouncementSchema))
    body: Partial<CommunityAnnouncementInput>,
  ) {
    return this.communities.updateAnnouncement(id, announcementId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/announcements/:announcementId')
  deleteAnnouncement(
    @Param('id') id: string,
    @Param('announcementId') announcementId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communities.deleteAnnouncement(id, announcementId, user.id);
  }

  // Tournaments -------------------------------------------------------------

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/tournaments')
  tournaments(
    @Param('id') id: string,
    @CurrentUser() user: MaybeUser,
    @Query('status') status?: string,
  ) {
    return this.communities.listTournaments(id, user?.id ?? null, status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tournaments/:tournamentId')
  attachTournament(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communities.attachTournament(id, tournamentId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/tournaments/:tournamentId')
  detachTournament(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communities.detachTournament(id, tournamentId, user.id);
  }
}

@ApiTags('communities')
@Controller('c')
export class CommunityPublicController {
  constructor(private readonly communities: CommunitiesService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @CurrentUser() user: MaybeUser) {
    return this.communities.getBySlug(slug, user?.id ?? null);
  }
}
