import { Controller, Get, Post, Put, Delete, Param, Query, Body, BadRequestException } from '@nestjs/common';
import { PeopleService } from './people.service';
import { Prisma } from '@prisma/client';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('isDeleted') isDeleted?: string,
    @Query('folkGuideId') folkGuideId?: string,
    @Query('enablerId') enablerId?: string,
    @Query('folkStage') folkStage?: string,
    @Query('lastCallStatus') lastCallStatus?: string,
    @Query('ids') ids?: string,
  ) {
    const where: Prisma.PersonWhereInput = {};
    const andFilters: Prisma.PersonWhereInput[] = [];

    if (search) {
      andFilters.push({
        OR: [
          { fullName: { contains: search } },
          { phone: { contains: search } },
          { location: { contains: search } },
        ],
      });
    }

    if (stage) {
      where.currentFolkStage = stage as any;
    }

    if (folkStage) {
      where.currentFolkStage = folkStage as any;
    }

    if (isDeleted !== undefined) {
      where.isDeleted = isDeleted === 'true';
    }

    if (folkGuideId) {
      andFilters.push({
        OR: [
          { folkGuideId },
          { folkGuideId: null, enablerId: null },
        ],
      });
    }

    if (enablerId) {
      andFilters.push({
        OR: [
          { enablerId },
          { folkGuideId: null, enablerId: null },
        ],
      });
    }

    if (lastCallStatus) {
      where.lastCallStatus = lastCallStatus;
    }

    if (ids) {
      const idList = ids.split(',').map(id => id.trim());
      where.id = { in: idList };
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    return this.peopleService.findAll({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('stats')
  async getStats() {
    return this.peopleService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const person = await this.peopleService.findOne(id);
    if (!person) {
      throw new BadRequestException('Person not found');
    }
    return person;
  }

  @Post()
  async create(@Body() data: Prisma.PersonCreateInput) {
    // Check for duplicate phone
    const existing = await this.peopleService.findByPhone(data.phone);
    if (existing) {
      throw new BadRequestException('Phone number already exists');
    }
    return this.peopleService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Prisma.PersonUpdateInput) {
    return this.peopleService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.peopleService.softDelete(id);
  }
}
