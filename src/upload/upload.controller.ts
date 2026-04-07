import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserOrSwayGuard } from '../auth/guard/user.sway.guard';
import { CONST, ImageInterceptor } from '../common';

@Controller({ version: '1', path: 'upload' })
export class UploadController {
  @Post('image')
  @UseGuards(UserOrSwayGuard)
  @UseInterceptors(ImageInterceptor)
  @HttpCode(HttpStatus.OK)
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    const filePath = CONST.BASE_URL + file.path;
    file.path = filePath;
    return file;
  }
}
