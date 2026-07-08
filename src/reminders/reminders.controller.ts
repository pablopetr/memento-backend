import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Reminder } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  create(
    @Body() dto: CreateReminderDto,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.create(dto, userId);
  }

  @Get()
  findAll(
    @CurrentUser() userId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ): Promise<Reminder[]> {
    return this.remindersService.findAll(
      userId,
      take ? parseInt(take, 10) : 20,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.findOne(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.remove(id, userId);
  }
}
