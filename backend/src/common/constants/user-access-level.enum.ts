export enum UserAccessLevel {
  FULL = 'FULL',           // Full access - after old email confirms
  LIMITED = 'LIMITED',     // Limited access - right after email change
  SUSPENDED = 'SUSPENDED', // Suspended - when recovery initiated
}