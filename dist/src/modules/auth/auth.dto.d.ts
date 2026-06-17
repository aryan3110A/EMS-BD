export declare class LoginDto {
    email: string;
    password: string;
}
export declare class AuthResponseDto {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        officeId?: string;
        officeName?: string;
    };
}
