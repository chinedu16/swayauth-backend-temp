import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Admin,
  Client,
  Company,
  Organization,
  Prisma,
  ServiceMail,
  User,
} from '@prisma/client';
import * as argon from 'argon2';
import { JWTProp } from '../auth/type';
import { CONST, Decrypt, GenericResponse } from '../common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EditCompanyProfileDto,
  EditPassword,
  EditUserProfileDto,
} from './dto/account.dto';

@Injectable()
export class AccountService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async getProfile(jwt: JWTProp) {
    if (jwt.access === 'level_1') {
      return await this.prisma.user.findFirst({
        where: {
          id: jwt.sub,
        },
        include: {
          facebook: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          google: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
        },
      });
    } else if (['level_2', 'level_3'].includes(jwt.access)) {
      const client = await this.prisma.client.findFirst({
        where: {
          id: jwt.sub,
        },
        include: {
          facebook: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          google: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              bio: true,
              save_cards: true,
              email: true,
            },
          },
          association: {
            where: {
              company_id: jwt.company_id,
            },
            select: {
              permissions: true,
              access: true,
            },
          },
        },
      });
      if (client.association?.length) {
        client.association = client.association[0] as any;
      }
      return client;
    } else {
      return await this.prisma.admin.findFirst({
        where: {
          id: jwt.sub,
        },
        include: {
          facebook: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          google: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
        },
      });
    }
  }

  async changePhoto(
    jwt: Partial<JWTProp>,
    company: boolean,
    file: Express.Multer.File,
  ) {
    const filePath = CONST.BASE_URL + file.path;
    await (
      this.prisma[
        jwt.access == 'level_1'
          ? 'user'
          : ['level_2', 'level_3'].includes(jwt.access)
            ? 'client'
            : 'admin'
      ] as Prisma.ClientDelegate
    ).update({
      where: {
        id: jwt.sub,
      },
      data: {
        photo: filePath,
      },
    });
    file.path = filePath;
    return file;
  }

  async getAssocAccounts(jwt: JWTProp) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.association.findMany({
        where: { client_email: jwt.email },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.association.count({ where: { client_email: jwt.email } }),
    ]);

    return { data, total };
  }

  async switchClientAccount(id: string, jwt: JWTProp, ip_address: string) {
    if (id === jwt.company_id)
      throw new BadRequestException('Account is already active');
    const association = await this.prisma.client.update({
      where: {
        id: jwt.sub,
        association: {
          some: {
            client_email: jwt.email,
            company_id: id,
          },
        },
      },
      data: {
        ip_address,
        company_id: id,
      },
    });

    if (association) {
      return { message: 'Account switched successfully' };
    } else {
      throw new UnauthorizedException();
    }
  }

  async editUserProfile(
    dto: EditUserProfileDto,
    jwt: JWTProp,
    ip_address: string,
  ) {
    const { company_name, company_bio, ...rest } = dto;
    if (jwt.access === 'level_1') {
      return await this.prisma.user.update({
        where: {
          id: jwt.sub,
        },
        include: {
          facebook: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          google: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
        },
        data: { ...rest, ip_address },
      });
    } else {
      if (company_name || company_bio) {
        if (jwt.access === 'level_3') {
          await this.prisma.company.update({
            where: {
              id: jwt.company_id,
              email: jwt.email,
            },
            data: {
              name: company_name,
              bio: company_bio,
            },
          });
        } else {
          throw new UnauthorizedException();
        }
      }

      if (['level_4', 'level_5'].includes(jwt.access)) {
        return await this.prisma.admin.update({
          where: { id: jwt.sub },
          include: {
            facebook: {
              take: 1,
              select: {
                id: true,
                purpose: true,
              },
              orderBy: {
                id: 'desc',
              },
            },
            google: {
              take: 1,
              select: {
                id: true,
                purpose: true,
              },
              orderBy: {
                id: 'desc',
              },
            },
          },
          data: { ...rest, ip_address },
        });
      }

      const client = await this.prisma.client.update({
        where: {
          id: jwt.sub,
        },
        data: { ...rest, ip_address },
        include: {
          facebook: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          google: {
            take: 1,
            select: {
              id: true,
              purpose: true,
            },
            orderBy: {
              id: 'desc',
            },
          },
          company: {
            select: {
              name: true,
              email: true,
              bio: true,
              save_cards: true,
            },
          },
          association: {
            where: {
              company_id: jwt.company_id,
            },
            select: {
              permissions: true,
              access: true,
            },
          },
        },
      });

      if (client.association?.length) {
        client.association = client.association[0] as any;
      }

      return client;
    }
  }

  async editUserPassword(
    dto: EditPassword,
    jwt: JWTProp,
    ip_address: string,
  ): Promise<GenericResponse> {
    let person: (User | Client | Admin) & {
      organization?: Organization;
      company?: Company & { service_email: ServiceMail[] };
    };
    const isAdmin = ['level_4', 'level_5'].includes(jwt.access);
    if (jwt.access === 'level_1') {
      person = await this.prisma.user.findFirst({
        where: { id: jwt.sub },
        include: {
          company: {
            include: {
              service_email: {
                take: 1,
                orderBy: {
                  id: 'desc',
                },
              },
            },
          },
          organization: true,
          organization_token: true,
        },
      });
    } else if (['level_2', 'level_3'].includes(jwt.access)) {
      person = await this.prisma.client.findFirst({
        where: { id: jwt.sub },
        include: {
          company: {
            include: {
              service_email: {
                take: 1,
                orderBy: {
                  id: 'desc',
                },
              },
            },
          },
        },
      });
    } else {
      person = await this.prisma.admin.findFirst({
        where: { id: jwt.sub },
      });
    }

    if (!person || person?.status === 'disabled')
      throw new NotFoundException('Account does not exist');
    else if (!person.verified)
      throw new ForbiddenException('Account is not verified');

    if (!isAdmin) {
      if (person?.company?.status !== 'active')
        throw new NotFoundException('Account does not exist');
    }

    if (!(await argon.verify(person.password, dto.old_password)))
      throw new UnauthorizedException('Invalid password');

    const password = await argon.hash(dto.new_password);

    await (
      this.prisma[
        jwt.access === 'level_1' ? 'user' : isAdmin ? 'admin' : 'client'
      ] as Prisma.ClientDelegate
    ).update({
      where: { id: jwt.sub },
      data: {
        password,
        ip_address,
      },
    });

    let mailObject: Parameters<typeof this.mail.sendMail>[number] = {
      to: person.email,
      subject: 'Password Reset!',
      template: 'reset-password',
      company_id: (person as any)?.company_id,
      first_name: person.first_name,
      time: '24 hours',
    };

    if (jwt.access === 'level_1') {
      mailObject = {
        ...mailObject,
        location: person?.organization?.address,
        domain: person?.organization?.website,
        companyName: person?.organization?.name,
        from: person?.company?.service_email?.[0]?.email,
        username: person?.company?.service_email?.[0]?.username,
        password: Decrypt(person?.company?.service_email?.[0]?.password),
        host: person?.company?.service_email?.[0]?.host,
        image:
          person?.organization?.photo ||
          person?.company?.service_email?.[0]?.photo,
      };
    }

    await this.mail.sendMail(mailObject, !isAdmin);

    if (!isAdmin)
      await this.prisma.mail.create({
        data: {
          [jwt.access === 'level_1' ? 'user_id' : 'client_id']: jwt.sub,
          company_id: person?.company?.id,
          purpose: 'password',
        },
      });

    return { message: 'Password reset successful' };
  }

  async editCompanyProfile(dto: EditCompanyProfileDto, company: Company) {
    return await this.prisma.company.update({
      where: {
        id: company.id,
      },
      data: dto,
    });
  }
}
