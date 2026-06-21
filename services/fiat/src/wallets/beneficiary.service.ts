import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './beneficiary.entity';

@Injectable()
export class BeneficiaryService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
  ) {}

  async getUserBeneficiaries(userId: string): Promise<Beneficiary[]> {
    return this.beneficiaryRepo.find({
      where: { userId },
      order: { timesUsed: 'DESC', createdAt: 'DESC' },
      take: 50,
    });
  }

  async upsertBankBeneficiary(
    userId: string,
    params: {
      name: string;
      bankCode: string;
      bankName: string;
      accountNumber: string;
      lastAmount?: number;
    },
  ): Promise<Beneficiary> {
    let beneficiary = await this.beneficiaryRepo.findOne({
      where: { userId, type: 'bank', accountNumber: params.accountNumber },
    });

    if (beneficiary) {
      beneficiary.timesUsed += 1;
      beneficiary.lastAmount = params.lastAmount?.toString() ?? beneficiary.lastAmount;
      beneficiary.name = params.name;
    } else {
      beneficiary = this.beneficiaryRepo.create({
        userId,
        type: 'bank',
        name: params.name,
        bankCode: params.bankCode,
        bankName: params.bankName,
        accountNumber: params.accountNumber,
        lastAmount: params.lastAmount?.toString() ?? null,
        timesUsed: 1,
        isFavourite: false,
      });
    }

    return this.beneficiaryRepo.save(beneficiary);
  }

  async toggleFavourite(id: string, userId: string): Promise<Beneficiary> {
    const beneficiary = await this.beneficiaryRepo.findOneOrFail({ where: { id, userId } });
    beneficiary.isFavourite = !beneficiary.isFavourite;
    return this.beneficiaryRepo.save(beneficiary);
  }

  async deleteBeneficiary(id: string, userId: string): Promise<void> {
    await this.beneficiaryRepo.delete({ id, userId });
  }
}
