function parseGeminiResponse(responseText) {
  if (!responseText || typeof responseText !== "string" || responseText.trim() === "") {
    return {
      success: false,
      error: "Invalid Gemini response format.",
    };
  }

  try {
    const parsedResponse = JSON.parse(responseText);

    if (
      !parsedResponse.riskLevel ||
      !parsedResponse.issueType ||
      !parsedResponse.explanation ||
      !parsedResponse.suggestedFix
    ) {
      return {
        success: false,
        error: "Invalid Gemini response format.",
      };
    }

    return {
      success: true,
      riskLevel: parsedResponse.riskLevel,
      issueType: parsedResponse.issueType,
      explanation: parsedResponse.explanation,
      suggestedFix: parsedResponse.suggestedFix,
    };
  } catch (error) {
    return {
      success: false,
      error: "Invalid Gemini response format.",
    };
  }
}

module.exports = {
  parseGeminiResponse,
};