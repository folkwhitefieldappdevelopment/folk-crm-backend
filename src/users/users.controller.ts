import { Controller, Get, Post, Put, Delete, Param, Body, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { UsersService } from './users.service';

function prepareJsonFields(data: Record<string, any>): Record<string, any> {
  const prepared: Record<string, any> = { ...data };
  const jsonFields = ['role', 'reportsTo', 'pausedCallingSession'];
  for (const field of jsonFields) {
    if (prepared[field] !== undefined && typeof prepared[field] !== 'string') {
      prepared[field] = JSON.stringify(prepared[field]);
    }
  }
  return prepared;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('folk-guides')
  async getFolkGuides() {
    return this.usersService.getFolkGuides();
  }

  @Get('enablers')
  async getEnablers() {
    return this.usersService.getEnablers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Post()
  async create(@Body() data: Record<string, any>) {
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }
    try {
      return await this.usersService.create(prepareJsonFields(data));
    } catch (err) {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Record<string, any>) {
    try {
      return await this.usersService.update(id, prepareJsonFields(data));
    } catch (err) {
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
