import { http } from "./http";

/**
 * AdminController (catalogue v2)
 * - GET /monatis/admin/save
 * - GET /monatis/admin/init/basic
 * - GET /monatis/admin/delete/all
 */

export async function triggerSave(): Promise<void> {
  await http.get(`/monatis/admin/save`);
}

export async function initBasic(): Promise<void> {
  await http.get(`/monatis/admin/init/basic`);
}

export async function deleteAllData(): Promise<void> {
  await http.get(`/monatis/admin/delete/all`);
}
