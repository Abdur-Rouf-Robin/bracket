import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adminCreateGameSchema,
  adminCreateUserSchema,
  adminUpdateGameSchema,
  adminUpdateTournamentSchema,
  adminUpdateUserSchema,
} from '@bracket/shared';
import type {
  AdminCreateGameInput,
  AdminCreateUserInput,
  AdminUpdateGameInput,
  AdminUpdateTournamentInput,
  AdminUpdateUserInput,
} from '@bracket/shared';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  listUsers(@Query('q') q?: string) {
    return this.admin.listUsers(q);
  }

  @Post('users')
  createUser(
    @Body(new ZodValidationPipe(adminCreateUserSchema)) body: AdminCreateUserInput,
  ) {
    return this.admin.createUser(body);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) body: AdminUpdateUserInput,
  ) {
    return this.admin.updateUser(id, actor.id, body);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() actor: { id: string }, @Param('id') id: string) {
    return this.admin.deleteUser(id, actor.id);
  }

  @Get('tournaments')
  listTournaments(@Query('q') q?: string) {
    return this.admin.listTournaments(q);
  }

  @Patch('tournaments/:id')
  updateTournament(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateTournamentSchema))
    body: AdminUpdateTournamentInput,
  ) {
    return this.admin.updateTournament(id, body);
  }

  @Delete('tournaments/:id')
  deleteTournament(@Param('id') id: string) {
    return this.admin.deleteTournament(id);
  }

  @Get('games')
  listGames() {
    return this.admin.listGames();
  }

  @Post('games')
  createGame(
    @Body(new ZodValidationPipe(adminCreateGameSchema)) body: AdminCreateGameInput,
  ) {
    return this.admin.createGame(body);
  }

  @Patch('games/:id')
  updateGame(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateGameSchema)) body: AdminUpdateGameInput,
  ) {
    return this.admin.updateGame(id, body);
  }

  @Delete('games/:id')
  deleteGame(@Param('id') id: string) {
    return this.admin.deleteGame(id);
  }
}
