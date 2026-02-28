import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategy/jwt-auth.guard';
import { ElearningSetupService } from './elearning-setup.service';
import {
  MergeElearningClassesDto,
  SetupElearningClassDto,
  ToggleElearningVisibilityDto,
} from './dto/elearning-setup.dto';

@UseGuards(JwtAuthGuard)
@Controller('elearning/setup')
export class ElearningSetupController {
  constructor(private readonly elearningSetupService: ElearningSetupService) {}

  @Post('class')
  async setupClass(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SetupElearningClassDto,
    @Req() req,
  ) {
    return this.elearningSetupService.setupClass(dto, req.user);
  }

  @Post('merge')
  async mergeClasses(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: MergeElearningClassesDto,
    @Req() req,
  ) {
    return this.elearningSetupService.mergeClasses(dto, req.user);
  }

  @Patch('unmerge/:kelasId')
  async unmergeClass(@Param('kelasId', ParseIntPipe) kelasId: number, @Req() req) {
    return this.elearningSetupService.unmergeClass(kelasId, req.user);
  }

  @Patch('visibility')
  async toggleVisibility(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: ToggleElearningVisibilityDto,
    @Req() req,
  ) {
    return this.elearningSetupService.toggleVisibility(dto, req.user);
  }

  @Get('class/:kelasId')
  async getClassSetup(@Param('kelasId', ParseIntPipe) kelasId: number, @Req() req) {
    return this.elearningSetupService.getClassSetup(kelasId, req.user);
  }
}
