import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Transaction } from './transaction.entity';
import { paginatedResponse, successResponse } from '../common/response';

interface AuthRequest extends Request {
  user: { sub: string };
}

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  @Get()
  async getTransactions(
    @Req() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId: req.user.sub })
      .orderBy('tx.createdAt', 'DESC')
      .skip(skip)
      .take(limitNum);

    if (type && type !== 'all') {
      const typeMap: Record<string, string[]> = {
        credit: ['credit', 'transfer_in'],
        debit: ['transfer_out', 'airtime', 'data', 'electricity', 'cable'],
        transfers: ['transfer_in', 'transfer_out'],
        airtime: ['airtime'],
        data: ['data'],
        bills: ['electricity', 'cable'],
      };
      const types = typeMap[type] ?? [type];
      query.andWhere('tx.type IN (:...types)', { types });
    }

    if (search) {
      query.andWhere(
        '(tx.description ILIKE :search OR tx.reference ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();
    return paginatedResponse(data, total, pageNum, limitNum);
  }

  @Get(':id')
  async getTransaction(@Param('id') id: string, @Req() req: AuthRequest) {
    const tx = await this.txRepo.findOne({
      where: { id, userId: req.user.sub },
    });
    if (!tx) {
      return { success: false, message: 'Transaction not found' };
    }
    return successResponse(tx);
  }
}
