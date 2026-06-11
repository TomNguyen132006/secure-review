async function postMergeRequestComment(projectId, mrId, token, body) {
  if (!projectId || !mrId || !token || !body) {
    return {
      success: false,
      message: "Missing required GitLab comment information.",
    };
  }

  const encodedProjectId = encodeURIComponent(projectId);

  const url = `https://gitlab.com/api/v4/projects/${encodedProjectId}/merge_requests/${mrId}/notes`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: "Invalid or expired GitLab token.",
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        message: "Merge request not found.",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: "Unable to post GitLab MR comment.",
      };
    }

    return {
      success: true,
      message: "GitLab MR comment posted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message: "Unable to post GitLab MR comment.",
    };
  }
}

module.exports = {
  postMergeRequestComment,
};