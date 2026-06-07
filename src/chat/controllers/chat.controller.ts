import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionBoundGuard } from '../../auth/guards/session-bound.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { Principal } from '../../shared/domain/role';
import { Role } from '../../shared/domain/role';
import { SanitizeInputInterceptor } from '../../humanizer/interceptors/sanitize-input.interceptor';
import { StripMetadataInterceptor } from '../../humanizer/interceptors/strip-metadata.interceptor';
import type { SendChatMessageResult } from '../application/send-chat-message.use-case';
import { SendChatMessageUseCase } from '../application/send-chat-message.use-case';
import { ListChatMessagesUseCase } from '../application/list-chat-messages.use-case';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

@Controller('chat/messages')
@UseGuards(JwtAuthGuard, SessionBoundGuard, RolesGuard)
@UseInterceptors(SanitizeInputInterceptor, StripMetadataInterceptor)
@SkipThrottle({ auth: true, subscription: true })
export class ChatController {
  constructor(
    private readonly sendMessage: SendChatMessageUseCase,
    private readonly listMessages: ListChatMessagesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.User, Role.Admin)
  async send(
    @CurrentUser() principal: Principal,
    @Body() dto: SendMessageDto,
  ): Promise<SendChatMessageResult> {
    const result = await this.sendMessage.execute({
      userId: principal.userId,
      question: dto.question,
    });

    if (result.isErr) {
      throw result.error;
    }

    return result.value;
  }

  @Get()
  @Roles(Role.User, Role.Admin)
  async list(@CurrentUser() principal: Principal, @Query() query: ListMessagesDto) {
    return this.listMessages.execute({
      userId: principal.userId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @Roles(Role.User, Role.Admin)
  async getOne(@CurrentUser() principal: Principal, @Param('id') id: string) {
    const page = await this.listMessages.execute({
      userId: principal.userId,
      limit: 1,
      offset: 0,
    });

    const message = page.items.find((m) => m.id === id);
    if (!message) {
      throw new NotFoundException(`Message ${id} not found`);
    }

    if (message.userId !== principal.userId && principal.role !== Role.Admin) {
      throw new ForbiddenException('Access denied');
    }

    return message;
  }
}
