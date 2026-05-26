
async function fetchMergeRequestDiff(projectId, mrId, token) {
  if (!projectId || !mrId || !token) {
    return {
      success: false,
      message: "Project ID, merge request ID, and token are required.",
    };
  }

  const encodedProjectId = encodeURIComponent(projectId);

  const url = `https://gitlab.com/api/v4/projects/${encodedProjectId}/merge_requests/${mrId}/changes`;

  try {

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "PRIVATE-TOKEN": token,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Failed to fetch merge request diff.",
        status: response.status,
      };
    }

    const data = await response.json();


    const formattedChanges = (data.changes || []).map((file) => {
      return {
        old_path: file.old_path,
        new_path: file.new_path,
        diff: file.diff,
        new_file: file.new_file,
        deleted_file: file.deleted_file,
        renamed_file: file.renamed_file,
      };
    });

    return {
      success: true,
      mrId,
      changes: formattedChanges,
    };
  } catch (error) {
    return {
      success: false,
      message: "Unable to connect to GitLab.",
      error: error.message,
    };
  }
}

module.exports = {
  fetchMergeRequestDiff,
};