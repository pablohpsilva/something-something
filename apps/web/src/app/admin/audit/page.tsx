"use client";

export default function AuditPage() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Admin Access Disabled
        </h1>
        <p className="text-gray-600">
          Authentication has been removed from this application. Admin
          functionality is no longer available.
        </p>
      </div>
    </div>
  );
}
