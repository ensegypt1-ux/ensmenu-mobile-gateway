import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import {
  RedeemDurationVoucherDto,
  ValidateVoucherDto,
} from './dto/voucher.dto';

// TODO: remove owner/vouchers alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/vouchers', 'owner/vouchers'])
@UseGuards(OwnerOnlyGuard)
export class VouchersController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Post('validate')
  async validate(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: ValidateVoucherDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'vouchers/validate',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('redeem-duration')
  async redeemDuration(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: RedeemDurationVoucherDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'vouchers/redeem-duration',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
