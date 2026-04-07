import {
  PrismaClient,
  status,
  access,
  permissions,
  scope,
  verify_registration_type,
} from '@prisma/client';
import * as argon from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const seedMode = process.env.SEED_MODE || 'full';
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@swayauth.local';
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
  const password = await argon.hash(seedAdminPassword);
  const emailSuffix = Date.now();

  if (seedMode === 'admin') {
    const fullScope = Object.values(scope).filter(
      (s) => s !== scope.two_factor,
    );
    const admin = await prisma.admin.upsert({
      where: { email: seedAdminEmail },
      update: {
        password,
        status: status.active,
        verified: true,
        access: access.level_5,
        permissions: Object.values(permissions),
        scope: fullScope,
        two_factor_type: null,
        totp_secret: '',
      },
      create: {
        first_name: 'Super',
        last_name: 'Admin',
        email: seedAdminEmail,
        password,
        status: status.active,
        verified: true,
        access: access.level_5,
        permissions: Object.values(permissions),
        scope: fullScope,
        two_factor_type: null,
        totp_secret: '',
      },
    });

    console.log('Admin seed completed successfully!');
    console.log('--- SEEDED DATA ---');
    console.log(`Admin Email: ${admin.email}`);
    console.log(`Password: ${seedAdminPassword}`);
    console.log('-------------------');
    return;
  }

  if (seedMode === 'client') {
    const seedClientEmail =
      process.env.SEED_CLIENT_EMAIL || 'client@swayauth.local';
    const seedClientPassword =
      process.env.SEED_CLIENT_PASSWORD || 'Password123!';
    const seedCompanyEmail =
      process.env.SEED_COMPANY_EMAIL || 'company@swayauth.local';
    const seedCompanyName =
      process.env.SEED_COMPANY_NAME || 'SwayAuth Client Company';
    const seedOrganizationName =
      process.env.SEED_ORG_NAME || 'Test Organization';
    const seedOrganizationWebsite =
      process.env.SEED_ORG_WEBSITE || 'https://example.com';
    const seedOrganizationBio =
      process.env.SEED_ORG_BIO || 'A testing organization for SwayAuth.';

    const fullScope = Object.values(scope).filter(
      (s) => s !== scope.two_factor,
    );
    const clientPasswordHash = await argon.hash(seedClientPassword);

    let company = await prisma.company.findFirst({
      where: { email: seedCompanyEmail },
    });

    if (!company) {
      const appKey = await prisma.appKey.create({
        data: {
          key: `ak_test_${emailSuffix}.app`,
        },
      });

      const wallet = await prisma.wallet.create({
        data: {
          amount: 1000,
        },
      });

      company = await prisma.company.create({
        data: {
          name: seedCompanyName,
          email: seedCompanyEmail,
          status: status.active,
          verified: true,
          app_key_id: appKey.id,
          wallet_id: wallet.id,
        },
      });
    }

    const companyWithKey = await prisma.company.findFirst({
      where: { id: company.id },
      include: { app_key: true },
    });
    const existingKey = companyWithKey?.app_key?.key;
    if (existingKey && existingKey.slice(-3) !== 'app') {
      const newKey = `ak_test_${Date.now()}.app`;
      const newAppKey = await prisma.appKey.create({
        data: { key: newKey },
      });
      await prisma.company.update({
        where: { id: company.id },
        data: { app_key_id: newAppKey.id },
      });
      companyWithKey.app_key.key = newKey;
    }

    const client = await prisma.client.upsert({
      where: { email: seedClientEmail },
      update: {
        password: clientPasswordHash,
        status: status.active,
        verified: true,
        company_id: company.id,
        scope: fullScope,
        two_factor_type: null,
        totp_secret: '',
      },
      create: {
        first_name: 'John',
        last_name: 'Client',
        email: seedClientEmail,
        password: clientPasswordHash,
        status: status.active,
        verified: true,
        company_id: company.id,
        scope: fullScope,
        two_factor_type: null,
        totp_secret: '',
      },
    });

    const existingAssociation = await prisma.association.findFirst({
      where: {
        company_id: company.id,
        client_email: client.email,
      },
    });
    const association =
      existingAssociation ||
      (await prisma.association.create({
        data: {
          verified: true,
          creator: true,
          permissions: Object.values(permissions),
          access: access.level_3,
          company_id: company.id,
          client_email: client.email,
        },
      }));
    if (existingAssociation) {
      await prisma.association.update({
        where: { id: existingAssociation.id },
        data: {
          verified: true,
          creator: true,
          permissions: Object.values(permissions),
          access: access.level_3,
        },
      });
    }

    let organization = await prisma.organization.findFirst({
      where: {
        company_id: company.id,
        name: seedOrganizationName,
      },
    });
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: seedOrganizationName,
          website: seedOrganizationWebsite,
          bio: seedOrganizationBio,
          company_id: company.id,
        },
      });
    }

    const existingOrgToken = await prisma.organizationToken.findFirst({
      where: {
        company_id: company.id,
        organization_id: organization.id,
        name: 'Default Token',
      },
    });
    const orgTokenApiKey = `sk_test_${emailSuffix}_organization`;
    const orgToken = existingOrgToken
      ? await prisma.organizationToken.update({
          where: { id: existingOrgToken.id },
          data: {
            api_key: orgTokenApiKey,
            permissions: Object.values(permissions),
            scope: fullScope,
            verify_registration: true,
            verify_registration_type: verify_registration_type.mail_link,
          },
        })
      : await prisma.organizationToken.create({
          data: {
            name: 'Default Token',
            api_key: orgTokenApiKey,
            company_id: company.id,
            organization_id: organization.id,
            permissions: Object.values(permissions),
            scope: fullScope,
            verify_registration: true,
            verify_registration_type: verify_registration_type.mail_link,
          },
        });

    console.log('Client seed completed successfully!');
    console.log('--- SEEDED DATA ---');
    console.log(`Company Email: ${company.email}`);
    console.log(`Company ID: ${company.id}`);
    console.log(`Application Key: ${companyWithKey?.app_key?.key}`);
    console.log(`Client Email: ${client.email}`);
    console.log(`Client Password: ${seedClientPassword}`);
    console.log(`Association ID: ${association.id}`);
    console.log(`Organization ID: ${organization.id}`);
    console.log(`Organization Secret: ${orgToken.api_key}`);
    console.log('-------------------');
    return;
  }

  // 1. Create AppKey
  const appKey = await prisma.appKey.create({
    data: {
      key: `ak_test_${emailSuffix}.app`,
    },
  });

  // 2. Create Wallet
  const wallet = await prisma.wallet.create({
    data: {
      amount: 1000,
    },
  });

  // 3. Create Company
  const company = await prisma.company.create({
    data: {
      name: 'SwayAuth Inc',
      email: `company_${emailSuffix}@example.com`,
      status: status.active,
      verified: true,
      app_key_id: appKey.id,
      wallet_id: wallet.id,
    },
  });

  // 4. Create Admin
  const admin = await prisma.admin.create({
    data: {
      first_name: 'Super',
      last_name: 'Admin',
      email: `admin_${emailSuffix}@example.com`,
      password,
      status: status.active,
      verified: true,
      access: access.level_5,
      permissions: [permissions.read, permissions.write, permissions.delete],
      scope: [scope.manual, scope.mail, scope.sms],
    },
  });

  // 5. Create Client (Organization Owner)
  const client = await prisma.client.create({
    data: {
      first_name: 'John',
      last_name: 'Client',
      email: `client_${emailSuffix}@example.com`,
      password,
      status: status.active,
      verified: true,
      company_id: company.id,
      scope: [scope.manual],
    },
  });

  // 6. Create Organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      website: 'https://testorg.com',
      bio: 'A testing organization for SwayAuth.',
      company_id: company.id,
    },
  });

  // 7. Create Organization Token
  const orgToken = await prisma.organizationToken.create({
    data: {
      name: 'Default Token',
      api_key: `sk_test_${emailSuffix}_organization`,
      company_id: company.id,
      organization_id: organization.id,
      permissions: [permissions.read, permissions.write],
      scope: [scope.manual, scope.mail, scope.sms],
      verify_registration: true,
      verify_registration_type: verify_registration_type.mail_link,
    },
  });

  // 8. Create User
  const user = await prisma.user.create({
    data: {
      first_name: 'Jane',
      last_name: 'User',
      email: `user_${emailSuffix}@example.com`,
      password,
      status: status.active,
      verified: true,
      company_id: company.id,
      organization_id: organization.id,
      organization_token_id: orgToken.id,
      access: access.level_1,
      permissions: [permissions.read],
      scope: [scope.manual],
    },
  });

  console.log('Seeding completed successfully!');
  console.log('--- SEEDED DATA ---');
  console.log(`Admin Email: ${admin.email}`);
  console.log(`Client Email: ${client.email}`);
  console.log(`User Email: ${user.email}`);
  console.log(`Password (for all): Password123!`);
  console.log(`Organization ID: ${organization.id}`);
  console.log(`Organization Secret: ${orgToken.api_key}`);
  console.log('-------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
