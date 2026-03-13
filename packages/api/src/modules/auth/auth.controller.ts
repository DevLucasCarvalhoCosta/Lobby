import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  @ApiOperation({ summary: 'Initiate Steam login' })
  steamLogin() {
    // Passport handles the redirect
  }

  @Get('steam/callback')
  @UseGuards(AuthGuard('steam'))
  @ApiOperation({ summary: 'Steam login callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with session' })
  async steamCallback(@Req() req: Request, @Res() res: Response) {
    // User is attached to request by passport
    const user = req.user as any;
    
    if (user) {
      // Store user in session
      (req.session as any).user = {
        id: user.id,
        steamId: user.steamId,
        personaName: user.personaName,
        avatar: user.avatar,
      };
    }

    // Redirect to frontend
    const frontendUrl = process.env.WEB_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Returns current user or null' })
  async getCurrentUser(@Req() req: Request) {
    const sessionUser = (req.session as any)?.user;
    
    if (!sessionUser) {
      return { user: null };
    }

    // Get fresh user data
    const user = await this.authService.getUser(sessionUser.id);
    return { user };
  }

  @Get('logout')
  @ApiOperation({ summary: 'Logout current user' })
  async logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
    });
    
    const frontendUrl = process.env.WEB_URL || 'http://localhost:3000';
    res.redirect(frontendUrl);
  }
}
