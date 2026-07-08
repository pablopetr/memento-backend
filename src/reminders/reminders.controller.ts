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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Reminder } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiBearerAuth('access-token')
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new reminder' })
  @ApiResponse({
    status: 201,
    description: 'Reminder created',
    schema: {
      example: {
        id: 'abc123',
        title: 'Take medicine',
        description: 'After breakfast',
        scheduledAt: '2026-07-08T08:00:00.000Z',
        status: 'PENDING',
        userId: 'user-id',
        createdAt: '2026-07-07T12:00:00.000Z',
        updatedAt: '2026-07-07T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error or invalid date' })
  create(
    @Body() dto: CreateReminderDto,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List reminders for the current user' })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Reminders retrieved',
    schema: {
      example: [
        {
          id: 'abc123',
          title: 'Take medicine',
          scheduledAt: '2026-07-08T08:00:00.000Z',
          status: 'PENDING',
          userId: 'user-id',
        },
      ],
    },
  })
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
  @ApiOperation({ summary: 'Get a single reminder by ID' })
  @ApiParam({ name: 'id', example: 'abc123' })
  @ApiResponse({
    status: 200,
    description: 'Reminder found',
    schema: { example: { id: 'abc123', title: 'Take medicine', status: 'PENDING' } },
  })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder' })
  @ApiParam({ name: 'id', example: 'abc123' })
  @ApiResponse({
    status: 200,
    description: 'Reminder updated',
    schema: { example: { id: 'abc123', title: 'Updated title', status: 'PENDING' } },
  })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a reminder' })
  @ApiParam({ name: 'id', example: 'abc123' })
  @ApiResponse({
    status: 200,
    description: 'Reminder deleted',
    schema: { example: { id: 'abc123', title: 'Deleted reminder', status: 'PENDING' } },
  })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  remove(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ): Promise<Reminder> {
    return this.remindersService.remove(id, userId);
  }
}
