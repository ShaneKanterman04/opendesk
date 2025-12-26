import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(email: string, pass: string) {
    const hashedPassword = await bcrypt.hash(pass, 10);

    // If there are no users yet, make the first registered user an admin.
    const totalUsers = await this.usersService.count();
    const makeAdmin = totalUsers === 0;

    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      ...(makeAdmin ? { isAdmin: true } : {}),
    } as any);

    const { password, ...userWithoutPassword } = user;

    if (makeAdmin) {
      return {
        user: userWithoutPassword,
        adminWarning:
          'You are the first registered user and have been made an admin. For security, create another admin account and secure this one.',
      };
    }

    return { user: userWithoutPassword };
  }
}
