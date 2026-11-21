"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const readline = __importStar(require("readline"));
function promptHidden(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        const rlAny = rl;
        let muted = false;
        rlAny._writeToOutput = (s) => {
            if (!muted)
                rlAny.output.write(s);
        };
        rl.question(question, (answer) => {
            rl.close();
            process.stdout.write('\n');
            resolve(answer);
        });
        muted = true;
    });
}
async function main() {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) {
        console.error('Usage: set-user-password <email>');
        process.exit(1);
    }
    const prisma = new client_1.PrismaClient();
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            console.error(`No user with email ${email}`);
            process.exit(1);
        }
        const password = process.env.EMS_NEW_PASSWORD ?? (await promptHidden(`New password for ${email}: `));
        if (password.length < 10) {
            console.error('Password must be at least 10 characters.');
            process.exit(1);
        }
        if (!process.env.EMS_NEW_PASSWORD) {
            const confirm = await promptHidden('Confirm password: ');
            if (confirm !== password) {
                console.error('Passwords do not match.');
                process.exit(1);
            }
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await bcrypt.hash(password, 10) },
        });
        console.log(`Password updated for ${email} (${user.role}).`);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
//# sourceMappingURL=set-user-password.js.map