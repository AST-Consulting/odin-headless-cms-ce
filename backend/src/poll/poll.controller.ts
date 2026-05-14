import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  InternalServerErrorException,
  Get,
  Put,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { PollService } from './poll.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { GetCurrentUser } from '../auth/common/decorators';
import { TCurrentUserType } from '../auth/types/user.type';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('poll')
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('image'))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() createPollDto: CreatePollDto,
    @GetCurrentUser() user: TCurrentUserType,
    @UploadedFiles() files: any[],
  ) {
    try {
      const data = await this.pollService.createPoll(createPollDto, user, files);
      return {
        success: true,
        message: 'Poll created successfully',
        data,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Failed to create poll');
    }
  }

  @Get()
  async findAll(@Query() query: any) {
    try {
      const data = await this.pollService.findAll(query);
      return {
        success: true,
        message: 'Polls fetched successfully',
        ...data,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Failed to fetch polls');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.pollService.findOne(id);
      return {
        success: true,
        message: 'Poll details fetched successfully',
        data,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Failed to fetch poll details');
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePollDto: any,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    try {
      const data = await this.pollService.update(id, updatePollDto, user);
      return {
        success: true,
        message: 'Poll updated successfully',
        data,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Failed to update poll');
    }
  }

  @Post(':id/vote')
  async vote(@Param('id') id: string, @Body() voteDto: any) {
    try {
      const data = await this.pollService.vote(id, voteDto);
      return {
        success: true,
        message: 'Vote cast successfully',
        data,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Failed to cast vote');
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    try {
      const data = await this.pollService.remove(id, user);
      return {
        success: true,
        message: 'Poll deleted successfully',
        data,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Failed to delete poll');
    }
  }
}
