import { isValidObjectId, type HydratedDocument } from "mongoose";
import { canEditProject, HttpError, type AuthUser } from "@/lib/auth";
import { Project, type IProject } from "@/models/Project";

/**
 * Loads a project the current user is allowed to access.
 * Non-owners get a 404 (not 403) so project existence isn't leaked to other users.
 */
export async function loadProjectFor(user: AuthUser, id: string): Promise<HydratedDocument<IProject>> {
  if (!isValidObjectId(id)) throw new HttpError(404, "Project not found");
  const project = await Project.findById(id);
  if (!project || !canEditProject(user, project.createdBy)) throw new HttpError(404, "Project not found");
  return project;
}

export function toProjectJSON(project: HydratedDocument<IProject>, user: AuthUser) {
  return { ...project.toJSON(), canEdit: canEditProject(user, project.createdBy) };
}
