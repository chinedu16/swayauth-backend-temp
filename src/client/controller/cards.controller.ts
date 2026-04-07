import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { GetCompany } from '../decorator';
import { CardsService } from '../service/cards.service';
import { SaveCardsDto } from '../dto/wallet.dto';

@Controller({ version: '1', path: 'client/cards' })
@UseGuards(CompanyGuard)
export class CompanyCardsController {
  constructor(private cardService: CardsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getCards(@GetCompany() company: Company) {
    return this.cardService.getCards(company);
  }

  @Put('save-cards')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  saveCards(@GetCompany() company: Company, @Query() dto: SaveCardsDto) {
    return this.cardService.saveCards(dto, company);
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_3']))
  deleteCard(@Param('id') id: string, @GetCompany() company: Company) {
    return this.cardService.deleteCard(id, company);
  }
}
