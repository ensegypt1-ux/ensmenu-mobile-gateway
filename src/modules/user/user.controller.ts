import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/user alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/user', 'owner/user'])
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get('profile')
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'user/profile',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put('profile')
  async updateProfile(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: 'user/profile',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('subscription')
  async getSubscription(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'user/subscription',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('plans')
  async getPlans(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'user/plans',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  /** Proxied for parity with web; not used by mobile UI in Phase 1. */
  @Post('subscription/downgrade-to-free')
  async downgradeToFree(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'user/subscription/downgrade-to-free',
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('subscription/recover-payment')
  async recoverPayment(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'user/subscription/recover-payment',
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
