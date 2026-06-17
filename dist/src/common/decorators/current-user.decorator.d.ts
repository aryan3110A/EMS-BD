export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    officeId?: string;
    name: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
