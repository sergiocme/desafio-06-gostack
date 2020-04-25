import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const temporaryFolder = path.resolve(__dirname, '..', '..', 'tmp');
export default {
  directory: temporaryFolder,
  storage: multer.diskStorage({
    destination: temporaryFolder,
    filename: (request, file, callback) => {
      const fileHash = crypto.randomBytes(10).toString('HEX');
      const fileName = `${fileHash}-${file.originalname}`;
      return callback(null, fileName);
    },
  }),
};
