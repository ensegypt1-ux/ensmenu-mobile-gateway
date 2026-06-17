import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/auth alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/auth', 'owner/auth'])
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Public()
  @Get('check-availability')
  async checkAvailability(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'auth/check-availability',
      req,
      query,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Public()
  @Post('signup')
  async signup(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/signup',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Public()
  @Post('login')
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/login',
      req,
      body,
    });

    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/refresh',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/forgot-password',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/reset-password',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Public()
  @Post('google')
  async google(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/google',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('me')
  async me(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'auth/me',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'auth/logout',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
