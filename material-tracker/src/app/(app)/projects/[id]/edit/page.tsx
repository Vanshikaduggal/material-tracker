"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Project } from "@/lib/types";
import { ProjectForm } from "@/components/ProjectForm";
import { Alert, PageLoader } from "@/components/ui";

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ project: Project }>(`/api/projects/${id}`)
      .then((d) => (d.project.canEdit ? setProject(d.project) : setError("You don't have permission to edit this project.")))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!project) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${id}`} className="text-sm text-blue-600 hover:underline">
          ← Back to project
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Edit project</h1>
        <p className="mt-1 text-sm text-slate-500">{project.name}</p>
      </div>
      <ProjectForm initial={project} />
    </div>
  );
}
