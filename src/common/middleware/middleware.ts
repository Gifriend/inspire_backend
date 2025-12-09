import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  // Inisialisasi Logger bawaan NestJS dengan label 'HTTP'
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, body } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    // Event listener yang akan jalan setelah respon SELESAI dikirim ke user
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const delay = Date.now() - startTime;

      // Log Format: [METHOD] URL STATUS - Waktu ms - UserAgent
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength}b - ${delay}ms - ${userAgent}`,
      );

      // Log Body (Hanya jika error atau untuk debug, hati-hati dengan password!)
      // PERBAIKAN: Tambahkan cek 'body' sebelum Object.keys()
      if (body && typeof body === 'object' && Object.keys(body).length > 0) {
        // Clone body agar aman
        const sanitizedBody = { ...body };
        
        // Sembunyikan password agar tidak muncul di log console
        if (sanitizedBody.password) sanitizedBody.password = '*****';
        
        this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`);
      }
    });

    next();
  }
}