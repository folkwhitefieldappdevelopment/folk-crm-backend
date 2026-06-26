import { Controller, Get, Post, Put, Delete, Param, Body, BadRequestException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Prisma } from '@prisma/client';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async findAll() {
    return this.groupsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const group = await this.groupsService.findOne(id);
    if (!group) {
      throw new BadRequestException('Group not found');
    }
    return group;
  }

  @Post()
  async create(@Body() data: Prisma.GroupCreateInput) {
    return this.groupsService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Prisma.GroupUpdateInput) {
    return this.groupsService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.groupsService.delete(id);
  }

  @Post(':id/members')
  async addMembers(@Param('id') id: string, @Body('personIds') personIds: string[]) {
    if (!Array.isArray(personIds) || personIds.length === 0) {
      throw new BadRequestException('personIds must be a non-empty array');
    }
    return this.groupsService.addMembers(id, personIds);
  }

  @Post(':id/add-by-phone')
  async addMembersByPhone(@Param('id') id: string, @Body('phoneNumbers') phoneNumbers: string[]) {
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      throw new BadRequestException('phoneNumbers must be a non-empty array');
    }
    return this.groupsService.addMembersByPhone(id, phoneNumbers);
  }

  @Delete(':id/members/:personId')
  async removeMember(@Param('id') id: string, @Param('personId') personId: string) {
    return this.groupsService.removeMember(id, personId);
  }
}
