const handlers: (() => Promise<void>)[] = [];
const registerGracefulShutdownHandler = (handler: () => Promise<void>) => handlers.push(handler);

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    await Promise.all(handlers.map(async handler => await handler()));
    process.exit();
}

export default registerGracefulShutdownHandler;
