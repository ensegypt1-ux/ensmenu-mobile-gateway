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
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  sendProxyResponse,
  STAFF_JOB_ROLE_HEADER,
  STAFF_ORDER_ENRICHMENT_HEADER,
  STAFF_ORDER_PRESENTER_HEADER,
  STAFF_ORDER_PRESENTER_VERSION,
} from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import { StaffOrdersFlowService } from './staff-orders-flow.service';

/**
 * Ensmenu Staff mobile app — auth and order operations via Express upstream.
 */
@Controller('mobile/v1/staff')
@UseGuards(JwtAuthGuard)
export class StaffAppController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
    private readonly ordersFlow: StaffOrdersFlowService,
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

  @Get('capabilities')
  async capabilities(@Req() req: Request, @Res() res: Response) {
    const data = await this.ordersFlow.getCapabilities(req);
    sendProxyResponse(
      res,
      { status: 200, data },
      this.assetUrlService,
      this.presenterHeaders(data.staffJobRole, 'capabilities'),
    );
  }

  @Get('orders')
  async listOrders(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const presented = await this.ordersFlow.listOrders(req, query);
    sendProxyResponse(
      res,
      { status: 200, data: presented },
      this.assetUrlService,
      this.presenterHeaders(presented.staffJobRole, 'list'),
    );
  }

  @Get('orders/:id')
  async getOrder(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const staffCallId = Number(id);
    const presented = await this.ordersFlow.getOrder(req, staffCallId, query);

    if (presented.denied) {
      res.status(presented.httpStatus).json(presented.data);
      return;
    }

    sendProxyResponse(
      res,
      { status: 200, data: presented.data },
      this.assetUrlService,
      this.presenterHeaders(presented.data.staffJobRole, 'detail'),
    );
  }

  @Post('orders/:id/actions')
  async postOrderAction(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const staffCallId = Number(id);
    const action = String(body.action ?? '');
    const menuId = this.ordersFlow.parseMenuId({}, body);
    const activityLogId = Number(body.activityLogId ?? 0) || undefined;
    const result = await this.ordersFlow.postOrderAction(
      req,
      staffCallId,
      action,
      menuId,
      activityLogId,
    );
    sendProxyResponse(res, result, this.assetUrlService);
  }

  private presenterHeaders(
    staffJobRole: string,
    enrichment: string,
  ): Record<string, string> {
    return {
      [STAFF_ORDER_PRESENTER_HEADER]: STAFF_ORDER_PRESENTER_VERSION,
      [STAFF_ORDER_ENRICHMENT_HEADER]: enrichment,
      [STAFF_JOB_ROLE_HEADER]: staffJobRole,
    };
  }
}
