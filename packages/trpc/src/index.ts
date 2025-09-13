// Re-export everything
export * from "./server";
export * from "./client";
export * from "./context";
export * from "./routers";

// Export the main app router
export { appRouter, type AppRouter } from "./routers/app";
