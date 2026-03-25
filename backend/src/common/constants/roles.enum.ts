export enum Role {
    STUDENT = 1,
    INSTRUCTOR = 2,
    ADMIN = 3,
}

export const RoleNames = {
    [Role.STUDENT]: 'STUDENT',
    [Role.INSTRUCTOR]: 'INSTRUCTOR',
    [Role.ADMIN]: 'ADMIN',
};

export const RoleHierarchy: Record<Role, Role[]> = {
  [Role.STUDENT]: [Role.STUDENT],
  [Role.INSTRUCTOR]: [Role.INSTRUCTOR, Role.STUDENT],
  [Role.ADMIN]: [Role.ADMIN, Role.INSTRUCTOR, Role.STUDENT],
};