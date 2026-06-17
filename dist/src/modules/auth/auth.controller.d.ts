import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            officeId: string | undefined;
            officeName: string | undefined;
        };
    }>;
    me(user: JwtPayload): Promise<{
        id: string;
        email: string;
        name: string;
        role: string;
        officeId: string | null;
        officeName: string | undefined;
    }>;
}
