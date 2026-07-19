import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import {
  VerifykitReferenceDto,
  VerifykitSessionDto,
  VerifykitStartDto,
} from './dto/verifykit.dto';

// TODO: remove owner/verifykit alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/verifykit', 'owner/verifykit'])
@UseGuards(OwnerOnlyGuard)
export class VerifykitController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Post('start')
  async start(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: VerifykitStartDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'verifykit/start',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('check')
  async check(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: VerifykitReferenceDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'verifykit/check',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('result')
  async result(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: VerifykitSessionDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'verifykit/result',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('complete')
  async complete(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: VerifykitSessionDto,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'verifykit/complete',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
