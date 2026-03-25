import { Role } from "./roles.enum";

export enum Permission {
  // User permissions
  USER_VIEW = 'user:view',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_LIST = 'user:list',
  
  // Course permissions
  COURSE_VIEW = 'course:view',
  COURSE_CREATE = 'course:create',
  COURSE_UPDATE = 'course:update',
  COURSE_DELETE = 'course:delete',
  COURSE_PUBLISH = 'course:publish',
  
  // Enrollment permissions
  ENROLL_VIEW = 'enroll:view',
  ENROLL_CREATE = 'enroll:create',
  ENROLL_DELETE = 'enroll:delete',
  
  // Quiz permissions
  QUIZ_VIEW = 'quiz:view',
  QUIZ_CREATE = 'quiz:create',
  QUIZ_UPDATE = 'quiz:update',
  QUIZ_DELETE = 'quiz:delete',
  QUIZ_ATTEMPT = 'quiz:attempt',
  
  // Payment permissions
  PAYMENT_VIEW = 'payment:view',
  PAYMENT_CREATE = 'payment:create',
  PAYMENT_REFUND = 'payment:refund',
  
  // Admin permissions
  ADMIN_ACCESS = 'admin:access',
  ROLE_MANAGE = 'role:manage',
  PERMISSION_MANAGE = 'permission:manage',
}

const STUDENT_PERMISSIONS = [
  Permission.USER_VIEW,
  Permission.COURSE_VIEW,
  Permission.ENROLL_VIEW,
  Permission.ENROLL_CREATE,
  Permission.QUIZ_VIEW,
  Permission.QUIZ_ATTEMPT,
  Permission.PAYMENT_VIEW,
  Permission.PAYMENT_CREATE,
];

const INSTRUCTOR_PERMISSIONS = [
  ...STUDENT_PERMISSIONS,
  Permission.COURSE_CREATE,
  Permission.COURSE_UPDATE,
  Permission.COURSE_DELETE,
  Permission.COURSE_PUBLISH,
  Permission.QUIZ_CREATE,
  Permission.QUIZ_UPDATE,
  Permission.QUIZ_DELETE,
];

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.STUDENT]: STUDENT_PERMISSIONS,
  [Role.INSTRUCTOR]: INSTRUCTOR_PERMISSIONS,
  [Role.ADMIN]: Object.values(Permission),
};