import { UserRole } from '../constants/enums';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: UserRole[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const IS_PUBLIC_KEY = "isPublic";
export declare const Public: () => import("@nestjs/common").CustomDecorator<string>;
export declare const OFFICE_KEY = "officeScoped";
export declare const OfficeScoped: () => import("@nestjs/common").CustomDecorator<string>;
