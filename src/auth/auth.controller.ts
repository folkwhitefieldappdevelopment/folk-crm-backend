import { Controller, Post, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() data: { email: string; password: string }) {
    return this.authService.login(data.email, data.password);
  }

  @Post('register')
  async register(@Body() data: { name: string; email: string; password: string; phone?: string }) {
    return this.authService.register(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(@Req() req: any, @Body() data: any) {
    return this.authService.updateProfile(req.user.id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Req() req: any) {
    return this.authService.refreshToken(req.user.id);
  }

  @Post('logout')
  async logout() {
    return this.authService.logout();
  }

  @Post('reset-password')
  async resetPassword(@Body() data: { email: string }) {
    return this.authService.resetPassword(data.email);
  }

  @Post('set-password')
  async setInitialPassword(@Body() data: { email: string; password: string }) {
    return this.authService.setInitialPassword(data.email, data.password);
  }

  @UseGuards(JwtAuthGuard)
  @Put('password')
  async changePassword(@Req() req: any, @Body() data: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, data.currentPassword, data.newPassword);
  }
}
