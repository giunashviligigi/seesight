import {
  ApprovalStatus,
  Prisma,
  TripStatus,
  UserRole,
} from '@prisma/client';

describe('Prisma domain schema (Milestone 3)', () => {
  it('exposes all core model names', () => {
    expect(Object.values(Prisma.ModelName).sort()).toEqual(
      [
        'AiRecommendation',
        'Approval',
        'ApprovalAction',
        'Company',
        'Department',
        'Employee',
        'FlightOfferSnapshot',
        'HotelOfferSnapshot',
        'Notification',
        'PasswordResetToken',
        'ReportCache',
        'Trip',
        'TripTraveler',
        'User',
      ].sort(),
    );
  });

  it('exposes domain enums', () => {
    expect(TripStatus.DRAFT).toBe('DRAFT');
    expect(TripStatus.PENDING_APPROVAL).toBe('PENDING_APPROVAL');
    expect(TripStatus.APPROVED).toBe('APPROVED');
    expect(ApprovalStatus.PENDING).toBe('PENDING');
    expect(ApprovalStatus.REJECTED).toBe('REJECTED');
    expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
    expect(UserRole.COMPANY_ADMIN).toBe('COMPANY_ADMIN');
    expect(UserRole.EMPLOYEE).toBe('EMPLOYEE');
  });
});
