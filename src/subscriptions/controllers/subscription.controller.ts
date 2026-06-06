import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionBoundGuard } from '../../auth/guards/session-bound.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { Principal } from '../../shared/domain/role';
import { Role } from '../../shared/domain/role';
import { SanitizeInputInterceptor } from '../../humanizer/interceptors/sanitize-input.interceptor';
import { StripMetadataInterceptor } from '../../humanizer/interceptors/strip-metadata.interceptor';
import { CreateSubscriptionUseCase } from '../application/create-subscription.use-case';
import { CancelSubscriptionUseCase } from '../application/cancel-subscription.use-case';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListMessagesDto } from '../../chat/controllers/dto/list-messages.dto';
import { Inject } from '@nestjs/common';
import { SUBSCRIPTION_BUNDLE_REPOSITORY } from '../domain/repositories/subscription-bundle.repository';
import type { SubscriptionBundleRepository } from '../domain/repositories/subscription-bundle.repository';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, SessionBoundGuard, RolesGuard)
@UseInterceptors(SanitizeInputInterceptor, StripMetadataInterceptor)
export class SubscriptionController {
  constructor(
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
    @Inject(SUBSCRIPTION_BUNDLE_REPOSITORY)
    private readonly bundleRepo: SubscriptionBundleRepository,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.User, Role.Admin)
  async create(@CurrentUser() principal: Principal, @Body() dto: CreateSubscriptionDto) {
    return this.createSubscription.execute({
      userId: principal.userId,
      tier: dto.tier,
      billingCycle: dto.billingCycle,
    });
  }

  @Get()
  @Roles(Role.User, Role.Admin)
  async list(@CurrentUser() principal: Principal, @Query() query: ListMessagesDto) {
    return this.bundleRepo.list({
      userId: principal.userId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.User, Role.Admin)
  async cancel(@CurrentUser() principal: Principal, @Param('id') id: string) {
    const result = await this.cancelSubscription.execute({
      subscriptionId: id,
      userId: principal.userId,
      role: principal.role,
    });

    if (result.isErr) {
      throw result.error;
    }
  }
}
