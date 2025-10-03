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

  // Validate queueType (optional, defaults to 'regular')
  if (data.queueType && !['regular', 'watchlist'].includes(data.queueType)) {
    return {
      success: false,
      error: "Queue type must be 'regular' or 'watchlist'",
    };
  }

  return { success: true, data: data };
};

export const validateNamespace = (namespace) => {
  const validNamespaces = ['non-watchlist', 'watchlist'];
  
  if (!namespace) {
    return {
      success: false,
      error: "Namespace is required"
    };
  }
  
  if (!validNamespaces.includes(namespace)) {
    return {
      success: false,
      error: `Namespace must be one of: ${validNamespaces.join(", ")}`
    };
  }
  
  return { success: true };
};

export const validateViewport = (viewport) => {
  if (!viewport) {
    return {
      success: false,
      error: "Viewport is required"
    };
  }
  
  // Validate viewport format: width,height (e.g., 1366,768)
  const viewportRegex = /^\d+,\d+$/;
  if (!viewportRegex.test(viewport)) {
    return {
      success: false,
      error: "Viewport must be in format: width,height (e.g., 1366,768)"
    };
  }
  
  // Split and validate individual dimensions
  const [width, height] = viewport.split(',');
  const widthNum = parseInt(width);
  const heightNum = parseInt(height);
  
  if (isNaN(widthNum) || isNaN(heightNum) || widthNum <= 0 || heightNum <= 0) {
    return {
      success: false,
      error: "Viewport dimensions must be positive numbers"
    };
  }
  
  return { success: true };
};
