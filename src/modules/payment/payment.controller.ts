import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { Request, Response } from 'express';
import { SensitiveThrottle } from '../../common/decorators/throttle.decorators';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import {
  InitiateExtraMenusPaymentDto,
  InitiateProPaymentDto,
} from './dto/payment-initiate.dto';

// TODO: remove owner/payment alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/payment', 'owner/payment'])
@UseGuards(OwnerOnlyGuard)
export class PaymentController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @SensitiveThrottle()
  @Post('subscription/pro-monthly/initiate')
  async initiateProMonthly(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: InitiateProPaymentDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'payment/subscription/pro-monthly/initiate',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @SensitiveThrottle()
  @Post('subscription/pro-yearly/initiate')
  async initiateProYearly(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: InitiateProPaymentDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'payment/subscription/pro-yearly/initiate',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @SensitiveThrottle()
  @Post('subscription/extra-menus/initiate')
  async initiateExtraMenus(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: InitiateExtraMenusPaymentDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'payment/subscription/extra-menus/initiate',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  /** EasyKash browser return — forward query string exactly (status, customerReference, …). */
  @Get('redirect')
  async handleRedirect(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'payment/redirect',
      req,
      query,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':orderId/status')
  async getPaymentStatus(
    @Req() req: Request,
    @Res() res: Response,
    @Param('orderId') orderId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `payment/${orderId}/status`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
