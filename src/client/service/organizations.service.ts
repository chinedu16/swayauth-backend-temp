import { Injectable, NotFoundException } from '@nestjs/common';
import { Company, Organization, OrganizationToken } from '@prisma/client';
import { CONST, genOrgToken } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../../subscription/subscription.service';
import {
  CreateEditOrganization,
  CreateEditOrganizationTokenDto,
  DeleteOrganizationTokenDto,
  OrganizationListDto,
} from '../dto/organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private subscription: SubscriptionService,
  ) {}

  async changeOrganizationPhoto(
    id: string,
    file: Express.Multer.File,
    company: Company,
  ) {
    await this.prisma.organization.update({
      where: {
        id,
        company_id: company.id,
      },
      data: {
        photo: CONST.BASE_URL + file.path,
      },
    });
    return { message: 'Organization logo updated successfully' };
  }

  async getOneOrganization(id: string, company: Company) {
    const org = await this.prisma.organization.findFirst({
      where: {
        id,
        company_id: company.id,
      },
    });
    if (!org) throw new NotFoundException('Record not found');
    return org;
  }

  async createOrganizationToken(
    id: string,
    dto: CreateEditOrganizationTokenDto,
    company: Company,
  ) {
    // const allowCreate = await this.subscription.allowOrganizationTokenCreate(company.id)

    // if (!allowCreate) throw new BadRequestException('Subscription service has expired or exceeded organization token limit');

    const count = await this.prisma.organization.count({
      where: { id, company_id: company.id },
    });
    if (!count) throw new NotFoundException('Organization not found');
    const data = await this.prisma.organizationToken.create({
      data: {
        ...dto,
        api_key: genOrgToken(),
        organization_id: id,
        company_id: company.id as never,
      },
    });
    return { data, message: 'Token created successfully' };
  }

  async deleteOrganizationToken(
    dto: DeleteOrganizationTokenDto,
    company: Company,
  ) {
    await this.prisma.organizationToken.deleteMany({
      where: {
        id: {
          in: dto.token_ids,
        },
        company_id: company.id,
      },
    });
    return { message: 'Token deleted successfully' };
  }

  async editOrganizationToken(
    id: string,
    dto: CreateEditOrganizationTokenDto,
    company: Company,
  ) {
    const count = await this.prisma.organizationToken.count({
      where: { id, company_id: company.id },
    });
    if (!count) throw new NotFoundException('Organization not found');
    const data = await this.prisma.organizationToken.update({
      where: { id, company_id: company.id },
      data: {
        ...dto,
      },
    });
    return { data, message: 'Token edited successfully' };
  }

  async getOrganizationTokens(
    id: string,
    params: OrganizationListDto,
    company: Company,
  ) {
    const sort = {
      skip: (params.page - 1) * params.size,
      take: params.size,
    };

    if (params.page == -1) {
      delete sort.take;
      sort.skip = 0;
    }

    const combine: {
      data: OrganizationToken[];
      total: number;
      page: number;
      size: number;
    } = {
      data: [],
      total: 0,
      page: params.page,
      size: params.size,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organizationToken.findMany({
        where: {
          organization_id: id,
          company_id: company.id,
        },
        orderBy: {
          [params.order_by]: params.direction,
        },
        ...sort,
      }),
      this.prisma.organizationToken.count({
        where: {
          organization_id: id,
          company_id: company.id,
        },
      }),
    ]);

    return { ...combine, data, total };
  }

  async getOrganizationList(params: OrganizationListDto, company: Company) {
    const sort = {
      skip: (params.page - 1) * params.size,
      take: params.size,
    };

    if (params.page == -1) {
      delete sort.take;
      sort.skip = 0;
    }

    const combine: {
      data: Organization[];
      total: number;
      page: number;
      size: number;
    } = {
      data: [],
      total: 0,
      page: params.page,
      size: params.size,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where: {
          company_id: company.id,
        },
        select: {
          id: true,
          photo: true,
          name: true,
          website: true,
          address: true,
          bio: true,
          company_id: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              organization_token: true,
            },
          },
        },
        orderBy: {
          [params.order_by]: params.direction,
        },
        ...sort,
      }),
      this.prisma.organization.count({
        where: {
          company_id: company.id,
        },
      }),
    ]);

    return { ...combine, data, total };
  }

  async createOrganization(dto: CreateEditOrganization, company: Company) {
    // const allowCreate = await this.subscription.allowOrganizationCreate(company.id)

    // if (!allowCreate) throw new BadRequestException('Subscription service has expired or exceeded organization limit');

    const data = await this.prisma.organization.create({
      data: {
        ...dto,
        company_id: company.id,
      },
    });
    return { data, message: 'Organization created successfully' };
  }

  async editOrganization(
    id: string,
    dto: CreateEditOrganization,
    company: Company,
  ) {
    const data = await this.prisma.organization.update({
      where: {
        id,
        company_id: company.id,
      },
      data: dto,
    });
    return { data, message: 'Organization edited successfully' };
  }

  async deleteOrganization(id: string, company: Company) {
    await this.prisma.organization.delete({
      where: {
        id: id,
        company_id: company.id,
      },
    });
    return { message: 'Organization deleted successfully' };
  }

  async getOrganizationTokenPublic(id: string) {
    const token = await this.prisma.organizationToken.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        redirect_url: true,
        origins: true,
        template: true,
        two_factor_type: true,
        verify_registration: true,
        verify_registration_type: true,
        permissions: true,
        scope: true,
        organization: {
          select: {
            id: true,
            photo: true,
            name: true,
            website: true,
            address: true,
            bio: true,
          },
        },
      },
    });
    if (!token) throw new NotFoundException('Record not found');
    return { data: token };
  }
}
