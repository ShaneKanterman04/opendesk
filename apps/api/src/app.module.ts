import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { DriveModule } from './drive/drive.module';
import { DocsModule } from './docs/docs.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UsersModule,
    StorageModule,
    DriveModule,
    DocsModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
