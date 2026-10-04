async function validateGitLabToken(token) {
  if (!token || token.trim() === "") {
    return {
      success: false,
      message: "GitLab token cannot be empty.",
    };
  }

  try {
    const response = await fetch("https://gitlab.com/api/v4/user", {
      method: "GET",
      headers: {
        "PRIVATE-TOKEN": token,
      },
    });

    if (response.status === 401) {
      return {
        success: false,
        message: "Invalid GitLab token.",
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        message:
          "GitLab rejected the token (HTTP 403). Make sure it has the read_api or api scope.",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: `GitLab token check failed (HTTP ${response.status}).`,
      };
    }

    const user = await response.json();

    return {
      success: true,
      user: user,
    };
  } catch (error) {
    return {
      success: false,
      message: "Unable to connect to GitLab.",
    };
  }
}

module.exports = {
  validateGitLabToken,
};
