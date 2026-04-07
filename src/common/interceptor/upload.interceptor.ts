import { UnsupportedMediaTypeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { generateRandomUUID } from '../util/crypto';

export const ImageInterceptor = FileInterceptor('file', {
  storage: multer.diskStorage({
    filename(_, file, callback) {
      const fileName = generateRandomUUID() + '.' + file.mimetype.split('/')[1];
      callback(null, fileName);
    },
    destination: 'uploads/',
  }),
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new UnsupportedMediaTypeException(), false);
    }
    cb(null, true);
  },
  limits: {
    fieldSize: 5000000, //5mb
  },
});
