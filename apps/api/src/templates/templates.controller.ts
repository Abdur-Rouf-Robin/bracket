import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createTemplateSchema,
  templateFromTournamentSchema,
  updateTemplateSchema,
  type CreateTemplateInput,
  type TemplateFromTournamentInput,
  type UpdateTemplateInput,
} from '@bracket/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TemplatesService } from './templates.service';

@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.templates.listMine(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createTemplateSchema)) body: CreateTemplateInput,
  ) {
    return this.templates.create(user.id, body);
  }

  @Post('from-tournament/:tournamentId')
  fromTournament(
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(templateFromTournamentSchema)) body: TemplateFromTournamentInput,
  ) {
    return this.templates.createFromTournament(user.id, tournamentId, body);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.templates.get(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateTemplateSchema)) body: UpdateTemplateInput,
  ) {
    return this.templates.update(id, user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.templates.remove(id, user.id);
  }

  @Post(':id/use')
  use(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.templates.use(id, user.id);
  }
}
