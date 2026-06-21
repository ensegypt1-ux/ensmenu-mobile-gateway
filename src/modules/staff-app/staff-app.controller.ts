import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { StaffOrderEnrichmentService } from './staff-order-enrichment.service';

/**
 * Ensmenu Staff mobile app — proxies to Express `/api/staff-auth/*`.
 * REST paths use `/orders` naming; upstream uses `table-calls`.
 */
@Controller('mobile/v1/staff')
@UseGuards(JwtAuthGuard)
export class StaffAppController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
    private readonly staffOrderEnrichment: StaffOrderEnrichmentService,
  ) {}

  @Public()
  @Post('auth/login')
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'staff-auth/login',
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('auth/me')
  async me(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-auth/me',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('auth/logout')
  async logout(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'staff-auth/logout',
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('orders')
  async listPending(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-auth/table-calls',
      req,
      query,
    });
    if (result.status >= 200 && result.status < 300) {
      const enriched = await this.staffOrderEnrichment.enrichOrderPayload(
        req,
        result.data,
      );
      result.data = enriched.data;
    }
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('orders/history')
  async listHistory(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-auth/table-calls/history',
      req,
      query,
    });
    if (result.status >= 200 && result.status < 300) {
      const enriched = await this.staffOrderEnrichment.enrichOrderPayload(
        req,
        result.data,
      );
      result.data = enriched.data;
    }
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('orders/:id')
  async getOrder(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `staff-auth/table-calls/${id}`,
      req,
    });
    if (result.status >= 200 && result.status < 300) {
      const enriched = await this.staffOrderEnrichment.enrichOrderPayload(
        req,
        result.data,
      );
      result.data = enriched.data;
    }
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put('orders/:id')
  async putOrder(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `staff-auth/table-calls/${id}`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch('orders/:id/status')
  async patchStatus(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `staff-auth/table-calls/${id}/status`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch('orders/:id/advance')
  async patchAdvance(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `staff-auth/table-calls/${id}/advance`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch('orders/:id/items')
  async patchItems(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `staff-auth/table-calls/${id}/items`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
