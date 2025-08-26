export const validateSingleBrand = (data) => {
  if (!data.id || data.id === "" || data.id === null || data.id === undefined) {
    return {
      success: false,
      error: "Brand ID is required. Please enter a valid brand ID.",
    };
  }
  if (
    !data.page_id ||
    data.page_id === "" ||
    data.page_id === null ||
    data.page_id === undefined
  ) {
    return {
      success: false,
      error: "Page ID is required. Please enter a valid page ID.",
    };
  }

  if (isNaN(data.id) || parseInt(data.id) <= 0) {
    return {
      success: false,
      error: "Brand ID must be a positive number (e.g., 5325)",
    };
  }

  if (!/^\d+$/.test(data.page_id)) {
    return {
      success: false,
      error: "Page ID must contain only numbers (e.g., 114512100010596)",
    };
  }

  // Validate score (optional, defaults to 0)
  if (data.score !== undefined && data.score !== null) {
    if (isNaN(data.score) || typeof data.score !== 'number') {
      return {
        success: false,
        error: "Score must be a valid number",
      };
    }
    
    // Allow any numeric score (positive, negative, or zero)
    // Score can be decimal numbers like 1.5, 0.5, -0.5, etc.
    if (!isFinite(data.score)) {
      return {
        success: false,
        error: "Score must be a finite number",
      };
    }
  }

  return { success: true, data: data };
};
