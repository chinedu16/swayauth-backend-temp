import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationToken, Company } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CONST,
  Encrypt,
  createReference,
  expireIn,
  gen6digit,
  verifyReference,
} from '../../common';
import { SmtpDto, SmtpVerifyDto } from '../dto';

@Injectable()
export class CompanyEmailService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async setupSMTP(dto: SmtpDto, company: Company) {
    let serviceMail = await this.prisma.serviceMail.findFirst({
      where: {
        company_id: company.id,
      },
    });

    if (serviceMail?.verified)
      throw new ConflictException('SMTP service is active for this account');

    const password = Encrypt(dto.password);

    serviceMail = await this.prisma.serviceMail.upsert({
      where: {
        company_id: company.id,
      },
      create: {
        ...dto,
        password,
        company_id: company.id,
      },
      update: {
        ...dto,
        password,
        company_id: company.id,
      },
    });

    const time = expireIn(60 * 24);
    const token = gen6digit().toString();
    const reference = createReference(serviceMail.id, 15, 'smtp', { token });

    await this.mail.sendMail({
      to: dto.email,
      first_name: company.name,
      company_id: company.id,
      time: '24 hours',
      subject: 'Verify smtp service!',
      template: 'smtp',
      token: token,
      tokenType: true,
    });

    await this.prisma.mail.create({
      data: {
        company_id: company?.id,
        purpose: 'smtp',
      },
    });

    await this.prisma.authorizationToken.create({
      data: {
        type: 'mail',
        token,
        email: dto.email,
        user_type: 'client',
        purpose: 'smtp',
        reference,
        company_id: company.id,
        expire_at: time,
      },
    });

    return {
      message: 'Smtp setup was successful',
      data: {
        reference,
        verification_enabled: true,
        verification_type: 'mail_token',
      },
    };
  }

  async uploadPhoto(company: Company, file: Express.Multer.File) {
    const filePath = CONST.BASE_URL + file.path;
    file.path = filePath;
    try {
      await this.prisma.serviceMail.update({
        where: {
          company_id: company.id,
        },
        data: {
          photo: filePath,
        },
      });
    } catch (error: any) {}
    return file;
  }

  async getSMTP(company: Company) {
    const serviceMail = await this.prisma.serviceMail.findFirst({
      where: {
        company_id: company.id,
      },
    });
    if (!serviceMail)
      throw new NotFoundException(
        'Smtp service for this account does not exist',
      );
    return serviceMail;
  }

  async deleteSMTP(company: Company) {
    const del = await this.prisma.serviceMail.delete({
      where: {
        company_id: company.id,
      },
    });
    if (!del)
      throw new NotFoundException(
        'Smtp service for this account does not exist',
      );
    return { message: 'Smtp service deleted successfully' };
  }

  async updateSMTP(dto: SmtpDto, company: Company) {
    try {
      if (dto?.password) dto.password = Encrypt(dto.password);

      const smtp = await this.prisma.serviceMail.update({
        where: {
          company_id: company.id,
        },
        data: {
          ...dto,
          verified: false,
        },
      });

      const time = expireIn(60 * 24);
      const token = gen6digit().toString();
      const reference = createReference(smtp.id, 15, 'smtp', { token });

      await this.mail.sendMail({
        to: dto.email,
        time: '24 hours',
        company_id: company.id,
        subject: 'Verify smtp service!',
        template: 'smtp',
        token: token,
        tokenType: true,
      });
      await this.prisma.mail.create({
        data: {
          company_id: company?.id,
          purpose: 'smtp',
        },
      });

      await this.prisma.authorizationToken.create({
        data: {
          type: 'mail',
          token,
          email: dto.email,
          user_type: 'client',
          purpose: 'smtp',
          reference,
          company_id: company.id,
          expire_at: time,
        },
      });

      return {
        message: 'Smtp service updated successfully',
        data: {
          reference,
          verification_enabled: true,
          verification_type: 'mail_token',
        },
      };
    } catch (error: any) {
      throw new NotFoundException('Smtp for this account does not exist');
    }
  }

  async verifySMTP(dto: SmtpVerifyDto, company: Company) {
    try {
      let authToken: AuthorizationToken;
      const ref = verifyReference(dto.reference);
      authToken = await this.prisma.authorizationToken.update({
        where: {
          reference: dto.reference,
          token: dto.token,
          used: false,
          purpose: 'smtp',
        },
        data: {
          used: true,
        },
      });
      await this.prisma.serviceMail.update({
        where: {
          company_id: company.id,
          id: ref.id,
        },
        data: {
          verified: true,
        },
      });
      return { message: 'Smtp service verified successfully' };
    } catch (error: any) {
      throw new NotFoundException('Smtp verifiction failed');
    }
  }
}
