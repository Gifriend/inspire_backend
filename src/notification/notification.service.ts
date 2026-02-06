import * as admin from 'firebase-admin';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as path from 'path';

@Injectable()
export class NotificationService implements OnModuleInit {
  onModuleInit() {
    // Inisialisasi Firebase Admin 
    if (admin.apps.length === 0) {
      const serviceAccountPath = path.join(
        process.cwd(),
        'bakticilik-2d48a-firebase-adminsdk-fbsvc-2e0df9f5c0.json',
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });

      // console.log('✅ Firebase Admin SDK initialized successfully');
    }
  }

  async sendMulticast(tokens: string[], title: string, body: string) {
    if (tokens.length === 0) {
      console.log('⚠️ No FCM tokens provided, skipping notification');
      return;
    }

    // Filter invalid tokens
    const validTokens = tokens.filter((token) => token && token.length > 0);

    if (validTokens.length === 0) {
      console.log('⚠️ No valid FCM tokens found');
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: validTokens,
        notification: {
          title: title,
          body: body,
        },
        // Tambahan untuk Android/iOS
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });

      console.log(
        `✅ Notifikasi dikirim: ${response.successCount} sukses, ${response.failureCount} gagal.`,
      );

      // Log failed tokens for debugging
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(
              `❌ Failed to send to token ${idx}: ${resp.error?.message}`,
            );
          }
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Error kirim notif:', error);
      throw error;
    }
  }
}
