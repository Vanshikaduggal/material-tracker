"use client";

import { ProjectForm } from "@/components/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Start a new project</h1>
        <p className="mt-1 text-sm text-slate-500">Capture order references, then add the bill of materials.</p>
      </div>
      <ProjectForm />
    </div>
  );
}
