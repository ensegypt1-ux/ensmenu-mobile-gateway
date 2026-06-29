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
import { sendProxyResponse, STAFF_JOB_ROLE_HEADER, STAFF_ORDER_ENRICHMENT_HEADER, STAFF_ORDER_PRESENTER_HEADER, STAFF_ORDER_PRESENTER_VERSION } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import { StaffOrderPresenterService, StaffOrderPresentResult } from './staff-order-presenter.service';
import { StaffOrdersFlowService } from './staff-orders-flow.service';

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
    private readonly orderPresenter: StaffOrderPresenterService,
    private readonly ordersFlow: StaffOrdersFlowService,
  ) {}

  private presenterHeaders(
    presented: StaffOrderPresentResult,
  ): Record<string, string> {
    return {
      [STAFF_ORDER_PRESENTER_HEADER]: STAFF_ORDER_PRESENTER_VERSION,
      [STAFF_ORDER_ENRICHMENT_HEADER]: presented.enrichment,
      [STAFF_JOB_ROLE_HEADER]: presented.staffJobRole,
    };
  }

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
    const presented = await this.ordersFlow.listOrders(
      req,
      query,
      'staff-auth/table-calls',
    );
    sendProxyResponse(
      res,
      { status: presented.httpStatus ?? 200, data: presented.data },
      this.assetUrlService,
      this.presenterHeaders(presented),
    );
  }

  @Get('orders/history')
  async listHistory(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const presented = await this.ordersFlow.listOrders(
      req,
      query,
      'staff-auth/table-calls/history',
    );
    sendProxyResponse(
      res,
      { status: presented.httpStatus ?? 200, data: presented.data },
      this.assetUrlService,
      this.presenterHeaders(presented),
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
    const menuId = this.ordersFlow.parseMenuId(query);
    const presented = await this.ordersFlow.getOrder(req, staffCallId, menuId);

    if (presented.denied) {
      res.status(403).json({
        error: 'Delivery orders are not available for your staff role',
        errorAr: 'طلبات التوصيل غير متاحة لدورك الوظيفي',
        code: 'STAFF_DELIVERY_DENIED',
      });
      return;
    }

    sendProxyResponse(res, { status: 200, data: presented.data }, this.assetUrlService, this.presenterHeaders(presented));
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
    const result = await this.ordersFlow.postOrderAction(
      req,
      staffCallId,
      action,
      menuId,
    );
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
    @Body() body: Record<string, unknown>,
  ) {
    const status = String(body.status ?? '').trim().toLowerCase();
    const action =
      status === 'prepared'
        ? 'TABLE_CALL_PREPARED'
        : status === 'delivered'
          ? 'TABLE_CALL_DELIVERED'
          : '';
    if (!action) {
      res.status(400).json({
        error: 'status must be prepared or delivered',
        errorAr: 'يجب أن تكون الحالة prepared أو delivered',
        code: 'INVALID_STATUS',
      });
      return;
    }
    const menuId = this.ordersFlow.parseMenuId({}, body);
    const result = await this.ordersFlow.postOrderAction(
      req,
      Number(id),
      action,
      menuId,
    );
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
