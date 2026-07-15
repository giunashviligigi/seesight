import {
  ApprovalActionType,
  ApprovalStatus,
  CompanyStatus,
  PrismaClient,
  TripStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('SecurePass1', 12);

  const company = await prisma.company.upsert({
    where: { slug: 'acme-travel' },
    update: {
      name: 'Acme Travel Co',
      status: CompanyStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      name: 'Acme Travel Co',
      legalName: 'Acme Travel Company LLC',
      slug: 'acme-travel',
      country: 'GE',
      billingEmail: 'billing@acme-travel.example',
      timezone: 'Asia/Tbilisi',
      status: CompanyStatus.ACTIVE,
      policyJson: {
        defaultBudgetCurrency: 'GEL',
        requireApprovalAbove: 1000,
      },
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@seesight.local' },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: null,
    },
    create: {
      email: 'superadmin@seesight.local',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: null,
    },
  });

  const companyAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme-travel.example' },
    update: {
      passwordHash,
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company.id,
      firstName: 'Ada',
      lastName: 'Admin',
    },
    create: {
      email: 'admin@acme-travel.example',
      passwordHash,
      firstName: 'Ada',
      lastName: 'Admin',
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
  });

  const employeeUser = await prisma.user.upsert({
    where: { email: 'traveler@acme-travel.example' },
    update: {
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId: company.id,
      firstName: 'Taylor',
      lastName: 'Traveler',
    },
    create: {
      email: 'traveler@acme-travel.example',
      passwordHash,
      firstName: 'Taylor',
      lastName: 'Traveler',
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
  });

  const engineering = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Engineering',
      },
    },
    update: { deletedAt: null, code: 'ENG' },
    create: {
      companyId: company.id,
      name: 'Engineering',
      code: 'ENG',
    },
  });

  const sales = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Sales',
      },
    },
    update: { deletedAt: null, code: 'SAL' },
    create: {
      companyId: company.id,
      name: 'Sales',
      code: 'SAL',
    },
  });

  const employeeTraveler = await prisma.employee.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: 'traveler@acme-travel.example',
      },
    },
    update: {
      userId: employeeUser.id,
      departmentId: engineering.id,
      firstName: 'Taylor',
      lastName: 'Traveler',
      jobTitle: 'Software Engineer',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      departmentId: engineering.id,
      userId: employeeUser.id,
      email: 'traveler@acme-travel.example',
      firstName: 'Taylor',
      lastName: 'Traveler',
      jobTitle: 'Software Engineer',
      phone: '+995555000111',
      status: UserStatus.ACTIVE,
    },
  });

  const employeeSales = await prisma.employee.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: 'sam.sales@acme-travel.example',
      },
    },
    update: {
      departmentId: sales.id,
      firstName: 'Sam',
      lastName: 'Sales',
      jobTitle: 'Account Executive',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      departmentId: sales.id,
      email: 'sam.sales@acme-travel.example',
      firstName: 'Sam',
      lastName: 'Sales',
      jobTitle: 'Account Executive',
      status: UserStatus.ACTIVE,
    },
  });

  const existingTrip = await prisma.trip.findFirst({
    where: {
      companyId: company.id,
      purpose: 'Client onboarding in Berlin',
      deletedAt: null,
    },
  });

  const trip =
    existingTrip ??
    (await prisma.trip.create({
      data: {
        companyId: company.id,
        createdByUserId: companyAdmin.id,
        purpose: 'Client onboarding in Berlin',
        destinationCountry: 'DE',
        destinationCity: 'Berlin',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-14'),
        budgetAmount: 1800,
        budgetCurrency: 'EUR',
        notes: 'Seeded sample trip for local demos',
        status: TripStatus.PENDING_APPROVAL,
        travelers: {
          create: [
            {
              employeeId: employeeTraveler.id,
              isPrimary: true,
            },
            {
              employeeId: employeeSales.id,
              isPrimary: false,
            },
          ],
        },
        approval: {
          create: {
            status: ApprovalStatus.PENDING,
            actions: {
              create: {
                actorUserId: companyAdmin.id,
                action: ApprovalActionType.SUBMIT,
                comment: 'Submitted for manager review (seed)',
              },
            },
          },
        },
        flightOfferSnapshots: {
          create: {
            providerOfferId: 'seed-flight-1',
            origin: 'TBS',
            destination: 'BER',
            departAt: new Date('2026-09-10T06:30:00.000Z'),
            returnAt: new Date('2026-09-14T18:00:00.000Z'),
            priceAmount: 620,
            currency: 'EUR',
            selected: true,
            rawPayload: {
              source: 'seed',
              carrier: 'LH',
            },
          },
        },
        hotelOfferSnapshots: {
          create: {
            providerOfferId: 'seed-hotel-1',
            hotelName: 'Berlin Central Inn',
            city: 'Berlin',
            checkIn: new Date('2026-09-10'),
            checkOut: new Date('2026-09-14'),
            priceAmount: 480,
            currency: 'EUR',
            selected: true,
            rawPayload: {
              source: 'seed',
              stars: 4,
            },
          },
        },
        aiRecommendations: {
          create: {
            provider: 'seed',
            promptSummary: 'Cheapest vs shortest itinerary for Berlin trip',
            responseJson: {
              recommendation: 'Choose morning outbound LH flight',
              rationale: 'Better connection time and lower total cost',
            },
          },
        },
      },
    }));

  await prisma.reportCache.upsert({
    where: {
      companyId_reportKey: {
        companyId: company.id,
        reportKey: 'monthly-spend-2026-09',
      },
    },
    update: {
      payloadJson: {
        currency: 'EUR',
        total: 1100,
        trips: 1,
      },
      generatedAt: new Date(),
      expiresAt: new Date('2026-12-31T23:59:59.000Z'),
    },
    create: {
      companyId: company.id,
      reportKey: 'monthly-spend-2026-09',
      payloadJson: {
        currency: 'EUR',
        total: 1100,
        trips: 1,
      },
      expiresAt: new Date('2026-12-31T23:59:59.000Z'),
    },
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        seeded: true,
        company: company.slug,
        users: [superAdmin.email, companyAdmin.email, employeeUser.email],
        password: 'SecurePass1',
        tripId: trip.id,
        departments: [engineering.name, sales.name],
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
