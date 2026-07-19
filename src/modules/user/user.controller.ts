import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/user alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/user', 'owner/user'])
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

  @Get('delivery/settings')
  async getDeliverySettings(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'user/delivery/settings',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put('delivery/settings')
  async updateDeliverySettings(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: 'user/delivery/settings',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('delivery/governorates')
  async getDeliveryGovernorates(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'user/delivery/governorates',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('delivery/governorates')
  async createDeliveryGovernorate(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'user/delivery/governorates',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put('delivery/governorates/:governorateId')
  async updateDeliveryGovernorate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('governorateId') governorateId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `user/delivery/governorates/${governorateId}`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete('delivery/governorates/:governorateId')
  async deleteDeliveryGovernorate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('governorateId') governorateId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `user/delivery/governorates/${governorateId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'user/change-password',
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete('account')
  async deleteAccount(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: 'user/account',
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('notifications')
  async getNotifications(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'user/notifications',
      req,
      query,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `user/notifications/${id}/read`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch('notifications/read-all')
  async markAllNotificationsRead(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'user/notifications/read-all',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete('notifications/:id')
  async deleteNotification(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `user/notifications/${id}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
