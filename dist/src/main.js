"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const port = Number(process.env.PORT) || configService.get('PORT', 3001);
    const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:3000');
    const isProduction = process.env.NODE_ENV === 'production';
    app.set('trust proxy', 1);
    app.disable('x-powered-by');
    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1');
    app.enableCors({
        origin: corsOrigin.split(',').map((o) => {
            const origin = o.trim();
            return origin.endsWith('/') ? origin.slice(0, -1) : origin;
        }),
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    const swaggerEnabled = !isProduction || process.env.ENABLE_SWAGGER === 'true';
    if (swaggerEnabled) {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('Export Management System API')
            .setDescription('Inventory, Contract, Production & Dispatch Management')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    await app.listen(port, '0.0.0.0');
    logger.log(`API listening on port ${port} (prefix /api/v1, env=${process.env.NODE_ENV ?? 'development'})`);
    if (swaggerEnabled)
        logger.log(`Swagger docs at /api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map