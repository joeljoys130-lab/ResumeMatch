import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { PayloadTooLargeError, ValidationError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'resume-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.docx', '.doc'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type. Only PDF (.pdf) and Word (.docx) documents are permitted.'), false);
  }
};

const uploadMulter = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB Max
  },
  fileFilter
});

export const uploadResumeMiddleware = (req, res, next) => {
  const uploadSingle = uploadMulter.single('resume');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new PayloadTooLargeError('Uploaded resume file exceeds the maximum 5 MB size limit.'));
      }
      return next(new ValidationError(`File upload error: ${err.message}`));
    } else if (err) {
      return next(err);
    }
    next();
  });
};
