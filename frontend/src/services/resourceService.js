import api from "./api";

/**
 * Trigger backend processing for an uploaded resource (Step 535)
 */
export async function processResource(resource) {
  const response = await api.post("/api/process-resource", {
    resource_id: resource.id,
    course_id: resource.course_id,
    subject_id: resource.subject_id,
    file_path: resource.file_path,
    resource_name: resource.name
  });

  return response.data;
}

/**
 * Fetch live status of a single resource (Step 558)
 */
export async function getResource(resourceId) {
  const response = await api.get(`/api/student/resources/${resourceId}/status`);
  return response.data;
}

export default {
  processResource,
  getResource
};
