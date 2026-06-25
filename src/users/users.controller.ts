import { Controller, Get, Post, Put, Delete, Param, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';

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
  async create(@Body() data: Prisma.UserCreateInput) {
    // Check for duplicate email
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }
    return this.usersService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
